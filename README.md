# GS-Intersect

Open-source tool for clinical trial design optimisation. Two interactive tools — a Group Sequential survival trial designer and a Simon 2-stage binary endpoint designer — each finding the power level that maximises a utility score across the full design space.

**Live:** https://gs-intersect.vercel.app

---

## Tools

### GS Design (`/`)
Group Sequential survival trial design using the `gsDesign` R package. Sweeps 11 power levels (50–99%) and computes utility at each interim and final analysis. Supports k=2, 3, or 4 analyses with configurable spending functions (O'Brien-Fleming, Pocock, custom).

**Utility:** `U = (1 − CV) × LR(+)` where `LR(+) = cumulative_power / alpha_spent`

### Simon 2-Stage (`/simon`)
Simon 2-stage binary endpoint design using the `clinfun` R package. Sweeps 43 power levels (50–99% at 1% resolution) and finds the optimal and minimax designs at each level.

**Utility:** `U = LR(+) × (CV_FA − p₀)` where `LR(+) = power / α`

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.2.1 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Charts | Plotly.js via react-plotly.js |
| R API | R Plumber (hosted on Render) |
| Deployment | Vercel (frontend), Render (API) |

---

## Project Structure

```
gs-intersect/
├── app/
│   ├── layout.tsx              # Root layout with NavBar
│   ├── page.tsx                # GS Design page
│   └── simon/
│       └── page.tsx            # Simon 2-stage page
│
├── components/
│   ├── NavBar.tsx              # Top navigation bar
│   ├── LoadingProgress.tsx     # Shared 3-phase loading indicator
│   │
│   │   ── GS Design ──
│   ├── InputPanel.tsx          # Parameter inputs (k, alpha, timing, HR, etc.)
│   ├── UtilityChart.tsx        # IA + FA utility charts + combined overlay
│   ├── OptimalCard.tsx         # Optimal IA/FA summary cards
│   ├── ResultsTable.tsx        # Full power sweep results table
│   │
│   │   ── Simon 2-Stage ──
│   ├── SimonInputPanel.tsx     # Parameter inputs (pu, pa, ep1, nmax)
│   ├── SimonChart.tsx          # Utility curve (N vs utility score)
│   ├── SimonAuxCharts.tsx      # LR(+) and MDE charts (side-by-side, below utility)
│   ├── SimonOptimalCard.tsx    # Optimal Stage 1 + Final Analysis summary cards
│   ├── SimonResultsTable.tsx   # Full power sweep results table
│   │
│   └── RawOutput.tsx           # Collapsible raw JSON (both tools)
│
├── lib/
│   ├── api.ts                  # Types, API calls, URL param serialisation, CSV/R exports
│   └── utils.ts                # Tailwind utility helpers
│
├── api/
│   ├── plumber.R               # R Plumber API (both /optimize and /simon endpoints)
│   ├── run.R                   # Plumber server entrypoint
│   └── README.md               # API documentation
│
└── docs/
    └── superpowers/
        ├── specs/              # Feature design specs
        └── plans/              # Implementation plans
```

---

## Local Development

### Frontend

```bash
npm install
npm run dev
```

Open http://localhost:3000. Requires `NEXT_PUBLIC_API_URL` set in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### R API

```r
install.packages(c("plumber", "gsDesign", "clinfun", "jsonlite"))
Rscript api/run.R
```

API runs on http://localhost:8000. Both endpoints include CORS headers for local development.

---

## Deployment

### Frontend → Vercel

Auto-deploys from `main` branch via the Vercel GitHub App (connected to `gainnoce/gs-intersect`). No manual step needed.

Set `NEXT_PUBLIC_API_URL` to the Render API URL in Vercel environment variables.

### R API → Render

Auto-deploys from `main` branch when `api/` files change. Configured via `render.yaml`. Start command: `Rscript api/run.R`.

**Note:** Render free tier cold-starts can take up to 50 seconds. The loading indicator communicates this to users.

---

## Key Design Decisions

### Chart axes (all charts)
All charts use a 4-axis layout: bottom x = events/N, top x = critical value (HR or ORR%), left y = utility score, right y = power%. This matches Fabio's R reference plots.

### Y-axis tick thinning
With many data points, Plotly's default auto-ticks don't align with actual data. A greedy pixel-gap algorithm (`pixelBudget / plotHeight` minimum gap) thins ticks to data-aligned values without crowding. `tickmode: "array"` is required for Plotly to respect custom tickvals.

### Right y-axis (power%)
Restricted to the ascending branch of the utility curve (rows where power ≤ optimal power) so labels always read monotonically upward, matching Fabio's convention.

### Alpha spend in headers
Fabio's relationship: `power = utility × alpha_spent`. Both IA and FA chart headers show the alpha spend at the optimal design so readers can verify this directly.

### Loading phases
API calls go through three phases:
1. **Connecting** — spinner + elapsed timer + 50s cold-start note
2. **Computing** — asymptotic progress bar (never plateaus, reaches ~86% at 50s)
3. **Processing** — brief full-bar flash before results render

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel + `.env.local` | Base URL of the R Plumber API |
| `ANTHROPIC_BASE_URL` | `~/.zshrc` | Routes Claude Code through Vercel AI Gateway |
| `ANTHROPIC_CUSTOM_HEADERS` | `~/.zshrc` | AI Gateway API key header |
