# Simon 2-Stage Design — Feature Spec

**Date:** 2026-06-01  
**Status:** Approved for implementation

---

## Overview

Add a Simon 2-stage binary endpoint design tool as a second page (`/simon`) alongside the existing group sequential survival tool. Completely independent implementation — no code shared with `UtilityChart.tsx` or the GS page components.

**Scientific context:** Simon's 2-stage design (Simon 1989) is the standard single-arm phase 2 design for binary endpoints (e.g. response rate). It defines two decision points: an interim (n1 patients) where the trial stops early if ≤ r1 responders are seen, and a final (n total) where the drug is declared promising if > r responders are seen. The `clinfun::ph2simon()` R function returns two variants: minimax (minimises max N) and optimal (minimises expected N under H0). **The optimal design is the primary output.**

---

## Parameters

| Parameter | Description | Default | Constraints |
|-----------|-------------|---------|-------------|
| `pu` | Unacceptable response rate (H0) | 0.30 | 0 < pu < pa < 1 |
| `pa` | Target response rate (H1) | 0.50 | 0 < pu < pa < 1 |
| `ep1` (α) | Type I error — max probability of declaring drug promising under H0 | 0.10 | 0.01–0.20 |
| `nmax` | Maximum total sample size | 150 | 10–1000 |

Power is swept: `ep2 = c(0.01, seq(0.05, 0.95, 0.05), 0.99)` → 21 power levels (matching the R reference script).

---

## API Endpoint — `/simon` (POST)

New endpoint in `api/plumber.R`.

**Request body:**
```json
{ "pu": 0.3, "pa": 0.5, "ep1": 0.1, "nmax": 150 }
```

**Processing (per power level):**
1. Call `ph2simon(pu, pa, ep1, ep2[j], nmax)$out` — returns a 2-row matrix: row 1 = minimax, row 2 = optimal
2. For each row: `r1 = out[i,1]`, `n1 = out[i,2]`, `r = out[i,3]`, `n = out[i,4]`, `EN0 = out[i,5]`
3. Compute:
   - `cv_IA = r1 / n1`
   - `cv_FA = r / n`
   - `plr = (1 - ep2[j]) / ep1`  (positive likelihood ratio = power / α)
   - `utility = plr * (cv_FA - pu)`
   - `en0_pct = EN0 / n`  (EN0 as fraction of total N)
   - `p_early_stop = pbinom(r1, n1, pu)`  (P(stop early | H0))
4. Find optimal row: `which.max(utility)` across all power levels → `optimal` result
5. Find minimax at same power level (for comparison)

**Response:**
```json
{
  "results": [
    {
      "power": 80,
      "r1": 2, "n1": 15, "r": 9, "n": 46,
      "cv_ia": 0.1333, "cv_fa": 0.1957,
      "en0": 21.4, "p_early_stop": 0.9115,
      "utility": 3.142,
      "minimax_r1": 3, "minimax_n1": 20, "minimax_r": 9, "minimax_n": 44,
      "minimax_cv_ia": 0.15, "minimax_cv_fa": 0.2045, "minimax_utility": 2.98
    },
    ...
  ],
  "optimal": { /* the result row with max utility */ },
  "feasible": true
}
```

If `ph2simon` cannot find a feasible design for a given power level, skip that row. If no feasible designs exist at all, return `{ "feasible": false, "error": "No feasible design found. Try increasing nmax or adjusting parameters." }`.

---

## Data Types — `lib/api.ts` additions

```typescript
interface SimonInputs {
  pu: number;
  pa: number;
  ep1: number;
  nmax: number;
}

interface SimonResult {
  power: number;
  r1: number; n1: number;
  r: number; n: number;
  cv_ia: number; cv_fa: number;
  en0: number; p_early_stop: number;
  utility: number;
  minimax_r1: number; minimax_n1: number;
  minimax_r: number; minimax_n: number;
  minimax_cv_ia: number; minimax_cv_fa: number; minimax_utility: number;
}

interface SimonResponse {
  results: SimonResult[];
  optimal: SimonResult;
  feasible: boolean;
  error?: string;
}
```

Functions to add: `runSimon(inputs)`, `simonInputsToParams()`, `simonParamsToInputs()`, `exportSimonRScript()`, `exportSimonCSV()`.

---

## New Files

```
app/
  simon/
    page.tsx              ← Simon page (client component, mirrors app/page.tsx structure)
components/
  SimonInputPanel.tsx     ← 4-field form: pu, pa, ep1, nmax
  SimonOptimalCard.tsx    ← Decision rules + key metrics for optimal design
  SimonChart.tsx          ← FA utility chart (Plotly, fresh implementation)
  SimonResultsTable.tsx   ← Full results table with export
```

No changes to existing components. Navigation bar added to `app/layout.tsx`.

---

## Navigation

Add a top nav bar to `app/layout.tsx`:

- **GS Design** → `/` (group sequential survival)
- **Simon 2-Stage** → `/simon`
- Active tab highlighted in AZ mulberry (`#830051`)
- Same header height as current page header; replaces per-page title rendering

---

## SimonInputPanel

Four numeric inputs with labels and tooltips:

| Field | Label | Tooltip |
|-------|-------|---------|
| `pu` | Unacceptable response rate (H0) | Response rate the drug must beat to be considered promising |
| `pa` | Target response rate (H1) | Response rate we want to detect with the specified power |
| `ep1` | Type I error (α) | Max probability of declaring drug promising when it isn't |
| `nmax` | Max sample size | Search limit; increase if no feasible design is found |

**Validation (on Run click):**
- `0 < pu < 1`, `0 < pa < 1`, `pu < pa`
- `0.01 ≤ ep1 ≤ 0.20`
- `10 ≤ nmax ≤ 1000`
- Clear error messages per field; invalid fields highlighted red

---

## SimonOptimalCard

Displays the utility-optimal design with decision rules in plain English. Two cards side by side:

**Stage 1 card:**
- "Stop early if ≤ **r1** responses in **n1** patients"
- P(early stop | H0): `p_early_stop` as %
- CV₁: `cv_ia` (4 dp)
- Interim N: `n1`

**Final analysis card:**
- "Declare promising if > **r** responses in **n** patients"  
- Power: `power`%
- CV: `cv_fa` (4 dp)
- Total N: `n`
- EN₀: `en0` (expected N under H0, 1 dp)

Below the two cards, a single-line summary:
> "Optimal design at **power**% power · α = **ep1** · EN₀ = **en0** · P(stop early | H0) = **p_early_stop**%"

---

## SimonChart

Single Plotly chart: **N (total) on x-axis, Utility on y-axis.**

Traces:
- Line + markers: optimal design type (blue, consistent with AZ palette)
- Vertical line at optimal N (solid, AZ mulberry)
- Top x-axis: `cv_fa` values (critical value at final analysis, same tick positions as N)
- Right y-axis: power % (same tick density algorithm as `UtilityChart` — pixel-gap greedy pass, min 14px gap)

Hover tooltip per point: Power %, N, r1, n1, r, CV_FA, Utility, EN₀, P(early stop | H0).

**Export PNG:** Same `downloadPngWithMeta` pattern as existing tool — title injected at +40px top margin, legend included. Title: `"Simon 2-Stage · H0: {pu*100}% · H1: {pa*100}% · α={ep1*100}%"`.

No carousel, no combined view, no multi-stage logic.

---

## SimonResultsTable

One row per power level. Columns:

| Power % | N₁ | r₁ | CV₁ | N | r | CV_FA | Utility | EN₀ | P(stop\|H0) % | Minimax N | Minimax CV_FA |

Optimal row highlighted. Export buttons:
- **Export R Script** — reproduces the `ph2simon()` call with the exact inputs
- **Export CSV** — all columns

---

## URL Serialisation

Query params: `pu`, `pa`, `ep1`, `nmax`. Share button copies URL to clipboard. Auto-run on load if params present.

---

## What's Excluded (YAGNI)

- IA utility chart (N₁ on x) — add only if Fabio requests it
- EN₁ (expected N under H1) — `ph2simon` doesn't return it directly; omit for now
- Bayesian priors or adaptive extensions
- Minimax as the primary/default design type

---

## Self-Review

- No placeholders or TBDs remain
- Minimax vs optimal distinction is explicit throughout (optimal = primary, minimax = comparison column)
- Feasibility failure is handled at the API and surfaced to the user
- All existing files untouched except `app/layout.tsx` (nav bar) and `lib/api.ts` (additions only)
- Scope is tight: one chart, four inputs, two cards, one table
