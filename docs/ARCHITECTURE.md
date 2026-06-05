# Architecture

## Overview

GS-Intersect is a stateless web application. The frontend (Next.js on Vercel) sends POST requests to an R Plumber API (on Render) which performs all statistical computation and returns JSON. No database, no auth, no server-side state.

```
Browser → Vercel (Next.js) → Render (R Plumber)
                ↑                    ↑
           Static pages         gsDesign / clinfun
```

Shareable URLs encode all inputs as query parameters — no session state needed.

---

## Utility formulas

### GS Design (survival endpoint)

At each analysis j:

```
alpha_spent_j = 2 × false_positive_rate_j        # two-sided
LR(+)_j       = cumulative_power_j / alpha_spent_j
utility_j     = (1 − CV_j) × LR(+)_j
```

The optimal design is the power level that maximises `utility_j` independently at each analysis.

**Fabio's key relationship:** `power = utility × alpha_spent`  
This is why alpha spend appears in chart headers — it lets readers verify power directly from the chart.

### Simon 2-stage (binary endpoint)

```
LR(+) = power / alpha                             # positive likelihood ratio
MDE   = CV_FA − p₀                               # minimum detectable effect
utility = LR(+) × MDE
```

---

## Chart system

### 4-axis Plotly layout

All charts share the same axis structure:

```
         [top]  FA ORR% CV  /  Critical Value (HR)   (xaxis2)
[left]   Utility / LR(+) / MDE                        (yaxis)
[right]  Power %                                       (yaxis2)
         [bottom]  Events  /  Total N                  (xaxis)
```

Secondary axes (`xaxis2`, `yaxis2`) require:
1. `overlaying: "x"` or `overlaying: "y"` 
2. A ghost trace (`x:[null], y:[null]`) to force Plotly to render them
3. `tickmode: "array"` if using custom `tickvals` — without this Plotly ignores the values

### Y-axis tick thinning

With many data points, showing all of them on the y-axis creates overlap. A greedy algorithm selects a non-crowded subset:

```ts
const minGap = (pixelBudget * ySpan) / plotHeight;

const thinned: T[] = [];
let last = -Infinity;
for (const row of sortedRows) {
  const v = getValue(row);
  if (v - last >= minGap) { thinned.push(row); last = v; }
}
```

`pixelBudget` is tuned per chart type (14–20px per label). `plotHeight` is the actual plot area in pixels (total height minus margins).

The optimal point is always force-included, with the preceding entry removed if it would be too close.

### Right y-axis (power%) — ascending branch restriction

The utility curve has an inflection point: utility rises then falls as power increases. If power% labels are placed on the right y-axis mapped to utility values, the labels go non-monotone near the inflection (e.g. "80% … 85% … 82%"), which is confusing.

Fix: only include rows where `power ≤ optimal_power` (the ascending branch). These rows have a monotone relationship between utility and power.

### CV (critical value) top-axis ticks

The top x-axis shows CV values aligned to event/N positions. With many data points, all ticks overlap. Fixed by:

```ts
const cvStride = Math.max(1, Math.ceil(ns.length / 9));
const thinnedNs = ns.filter((_, i) => i % cvStride === 0);
```

On zoom, the relayout handler recomputes thinning for the visible range.

---

## Component responsibilities

### `UtilityChart.tsx`

The most complex component. Renders three chart variants:
- **IA chart** (one per stage, carousel for k>2) — `singleLayout()` factory with `utilExtractor` and `powerExtractor` callbacks
- **FA chart** — same factory, different extractors and pixel budget
- **Combined overlay** — all IA + FA curves on one chart; separate greedy thinning for left axis (all curves combined) and right axis (FA ascending branch only)

Key internal functions:
- `singleLayout()` — builds Plotly layout for a single-series chart
- `greedyThin()` — tick thinning (both left and right axes)
- `smartTextPositions()` — collision-avoiding star label placement for the overlay
- `makeCvRelayout()` — zoom handler that updates CV tick density

### `SimonAuxCharts.tsx`

Two side-by-side charts below the Simon utility chart. Simpler than `UtilityChart` — no carousel, no overlay, no cross-reference vlines. Shares the same 4-axis structure and tick-thinning approach.

Derived series (computed in frontend, not returned by API):
- `LR(+) = (power / 100) / ep1`
- `MDE = cv_fa − pu`

### `LoadingProgress.tsx`

Three-phase loading indicator:
1. **Connecting** — spinning ring, elapsed-seconds counter, 50s cold-start note
2. **Computing** — animated progress bar using asymptotic curve: `88 × (1 − e^(−t/25000))`. Never plateaus — always visibly progressing even during long cold starts.
3. **Processing** — full bar flash before results render

Phase transitions in `handleRun()`:
- Immediately → "connecting"
- After 3s (if no response yet) → "computing"
- On response received → "processing" (500ms) → render results

---

## R API internals

### `/optimize` (GS Design)

1. Calls `gsSurv()` for each power level
2. Parses `gsBoundSummary()` output using a 5-rows-per-analysis formula:
   - Row `2 + (j−1)×5` → N / false-positive
   - Row `3 + (j−1)×5` → events / CV
   - Row `5 + (j−1)×5` → cumulative power
3. Computes utility, alpha spend, LR(+), r01m, maturity per stage
4. Returns results sorted by power level; frontend sorts by events/N for charts

### `/simon` (Simon 2-stage)

1. Calls `ph2simon()` for each ep2 value
2. Selects optimal row: `which.min(out[,5])` (min expected N under H₀)
3. Selects minimax row: `which.min(out[,4])` (min maximum N)
4. When both designs are identical, ph2simon returns 1 row — handled explicitly

Power sweep: `c(0.01, 0.05, seq(0.1, 0.5, 0.01))` — 43 levels, 1% resolution in 50–90% range. This matches Fabio's reference R script exactly.

---

## URL sharing

All inputs are serialised to URL query parameters via `inputsToParams()` / `paramsToInputs()` in `lib/api.ts`. Arrays are comma-joined. On page load, params are parsed and the optimisation auto-runs.

This means any result is fully reproducible by sharing the URL — no backend state needed.

---

## Known constraints

- **Render cold starts:** up to 50 seconds. Communicated via loading indicator.
- **R memory:** `gsDesign` can fail for extreme parameter combinations (very large N, degenerate timing). Failed power levels are silently dropped; if all fail, a 500 is returned.
- **Discrete designs (Simon):** `ph2simon` returns discrete designs, so consecutive power levels often map to the same design. The resulting staircase pattern in charts is correct, not a bug.
- **No auth:** this is an internal tool; adding auth would require Vercel middleware or a separate identity provider.
