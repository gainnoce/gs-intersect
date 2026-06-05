# GS-Intersect R API

R Plumber REST API powering the GS-Intersect platform. Provides two endpoints: Group Sequential survival trial design (`/optimize`) and Simon 2-stage binary endpoint design (`/simon`).

**Deployed on:** Render (auto-deploys from `main` branch)  
**Local port:** 8000

---

## Local Development

```r
install.packages(c("plumber", "gsDesign", "clinfun", "jsonlite"))
Rscript run.R
```

API runs on http://localhost:8000 with CORS open for all origins.

---

## Endpoints

### `POST /optimize` — Group Sequential Survival Design

Sweeps 11 power levels (50–99%) using `gsDesign::gsSurv()` and returns utility metrics at each interim and final analysis.

**Request body:**

| Field | Type | Default | Description |
|---|---|---|---|
| `k` | integer | 2 | Number of analyses (2–4) |
| `alpha` | number | 0.05 | Two-sided type I error |
| `timing` | number[] | [0.7] | Timing fractions for IAs (length k−1) |
| `hr` | number | 0.7 | Hazard ratio under H₁ |
| `medianC` | number | 12 | Median survival in control arm (months) |
| `eta` | number | 0.05 | Dropout rate |
| `minfup` | number | 24 | Minimum follow-up (months) |
| `gamma` | number[] | [2.5,5,7.5,10] | Enrollment rates |
| `R` | number[] | [2,2,2,12] | Enrollment period durations |
| `sfu` | string | "sfLDOF" | Upper spending function name |
| `sfl` | string | "sfLDOF" | Lower spending function name |

**Response:**

```json
{
  "k": 2,
  "results": [
    {
      "power": 80.0,
      "power_IA": 12.3,
      "N": 312,
      "events_IA": 156,
      "events_FA": 234,
      "cv_IA": 0.9823,
      "cv_FA": 0.6712,
      "utility_IA": 1.2341,
      "utility_FA": 0.9823,
      "alpha_IA": 0.002341,
      "alpha_FA": 0.047659,
      "ia_stages": [
        {
          "events": 156,
          "cv": 0.9823,
          "utility": 1.2341,
          "fp": 0.001171,
          "alpha": 0.002341,
          "power": 12.3,
          "r01m": 45.2,
          "maturity": 0.667
        }
      ]
    }
  ],
  "optimal_IA": { "...": "result row with highest utility_IA" },
  "optimal_FA": { "...": "result row with highest utility_FA" },
  "optimal_IAs": [ "...one optimal result per IA stage..." ]
}
```

**Utility formula:** `U = (1 − CV) × LR(+)` where `LR(+) = cumulative_power / alpha_spent`  
`alpha_spent = 2 × false_positive_rate` (two-sided)

---

### `POST /simon` — Simon 2-Stage Binary Endpoint Design

Sweeps 43 power levels using `clinfun::ph2simon()` and returns optimal and minimax designs at each level.

**Power sweep:** `c(0.01, 0.05, seq(0.1, 0.5, 0.01))` as type II error → power = 50–99% at 1% resolution

**Request body:**

| Field | Type | Default | Description |
|---|---|---|---|
| `pu` | number | 0.30 | Unacceptable response rate (H₀) |
| `pa` | number | 0.50 | Target response rate (H₁) |
| `ep1` | number | 0.10 | Type I error (α) |
| `nmax` | integer | 150 | Maximum total sample size |

**Response:**

```json
{
  "feasible": true,
  "results": [
    {
      "power": 84.0,
      "r1": 6,   "n1": 19,
      "r": 18,   "n": 45,
      "cv_ia": 0.3158,
      "cv_fa": 0.4000,
      "en0": 27.7,
      "p_early_stop": 0.6655,
      "utility": 0.5600,
      "minimax_r1": 6,  "minimax_n1": 20,
      "minimax_r": 17,  "minimax_n": 42,
      "minimax_cv_ia": 0.3000,
      "minimax_cv_fa": 0.4048,
      "minimax_utility": 0.5418
    }
  ],
  "optimal": { "...": "result row with highest utility" }
}
```

**Optimal design:** minimises expected N under H₀ (`EN(p0)`) — `ph2simon` row with `min(out[,5])`  
**Minimax design:** minimises maximum N — `ph2simon` row with `min(out[,4])`  
**Utility formula:** `U = LR(+) × (CV_FA − p₀)` where `LR(+) = power / α`

---

## Derived quantities (computed in frontend)

These are not returned by the API but computed in `components/SimonAuxCharts.tsx`:

- `LR(+) = power / (ep1 × 100)` — likelihood ratio, used in LR(+) chart
- `CV_FA − pu` — minimum detectable effect, used in MDE chart

---

## Error handling

Both endpoints use `tryCatch` per power level — failed levels are silently dropped. If all levels fail, a 500 error is returned with a descriptive message. The `/simon` endpoint returns `{ feasible: false, error: "..." }` (HTTP 200) if no feasible design exists within `nmax`.

---

## Deployment (Render)

Configured via `render.yaml` in the repo root. Auto-deploys on push to `main`.

Start command: `Rscript run.R`

Required R packages (installed at build time): `plumber`, `gsDesign`, `clinfun`, `jsonlite`
