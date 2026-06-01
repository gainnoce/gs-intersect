# Simon 2-Stage Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Simon 2-stage binary endpoint design tool at `/simon` alongside the existing group sequential survival tool.

**Architecture:** Option B — completely independent implementation. New `SimonChart`, `SimonInputPanel`, `SimonOptimalCard`, `SimonResultsTable` components share no code with `UtilityChart.tsx`. A new `NavBar` client component is added to `app/layout.tsx`; the existing GS page header is trimmed to remove its title (NavBar takes over branding). A new `/simon` Plumber endpoint drives the computations. Optimal design (ph2simon row with min EN₀) is primary; minimax (row with min n) is shown in the comparison table column.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, react-plotly.js, Tailwind CSS / shadcn, R Plumber, `clinfun::ph2simon`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `api/plumber.R` | Add `/simon` POST endpoint |
| Modify | `lib/api.ts` | Add Simon types + 5 new functions (append only) |
| Create | `components/NavBar.tsx` | Sticky top nav with GS/Simon tabs, AZ branding |
| Modify | `app/layout.tsx` | Render `<NavBar />` above children |
| Modify | `app/page.tsx` | Remove `<header>` block; move Share/Print into results area |
| Create | `components/SimonInputPanel.tsx` | 4-field form: pu, pa, ep1, nmax |
| Create | `components/SimonOptimalCard.tsx` | Decision-rules cards for optimal design |
| Create | `components/SimonChart.tsx` | Single Plotly chart: N on x, utility on y, CV top axis, power% right axis |
| Create | `components/SimonResultsTable.tsx` | Full results table + export buttons |
| Create | `app/simon/page.tsx` | Simon page — state, URL params, auto-run |

---

## Task 1: R API — `/simon` endpoint

**Files:**
- Modify: `api/plumber.R`

- [ ] **Step 1: Add `library(clinfun)` at the top of plumber.R**

Open `api/plumber.R`. After line 1 (`library(plumber)`), add:
```r
library(clinfun)
```

- [ ] **Step 2: Append the `/simon` endpoint to plumber.R**

After the closing `}` of the `/optimize` function (before the `%||%` definition at the end), add:

```r
#* Simon 2-stage design optimization
#* @post /simon
function(req) {
  body <- jsonlite::fromJSON(req$postBody)

  pu   <- as.numeric(body$pu   %||% 0.30)
  pa   <- as.numeric(body$pa   %||% 0.50)
  ep1  <- as.numeric(body$ep1  %||% 0.10)
  nmax <- as.integer(body$nmax %||% 150)

  ep2_seq <- c(0.01, seq(0.05, 0.95, 0.05), 0.99)   # 21 power levels
  lep2 <- length(ep2_seq)

  results <- vector("list", lep2)

  for (j in seq_len(lep2)) {
    ep2 <- ep2_seq[j]
    pwr <- 1 - ep2

    tryCatch({
      out <- ph2simon(pu, pa, ep1, ep2, nmax)$out

      # Identify rows: optimal = min EN(p0) col 5; minimax = min n col 4.
      # When both designs are identical, ph2simon returns 1 row.
      if (nrow(out) == 1) {
        opt_row <- 1; mmx_row <- 1
      } else {
        opt_row <- which.min(out[, 5])   # min expected N under H0
        mmx_row <- which.min(out[, 4])   # min maximum N
      }

      r1_opt  <- out[opt_row, 1]; n1_opt <- out[opt_row, 2]
      r_opt   <- out[opt_row, 3]; n_opt  <- out[opt_row, 4]
      en0_opt <- out[opt_row, 5]

      r1_mmx  <- out[mmx_row, 1]; n1_mmx <- out[mmx_row, 2]
      r_mmx   <- out[mmx_row, 3]; n_mmx  <- out[mmx_row, 4]

      plr           <- pwr / ep1
      cv_ia_opt     <- r1_opt / n1_opt
      cv_fa_opt     <- r_opt  / n_opt
      cv_fa_mmx     <- r_mmx  / n_mmx
      utility_opt   <- plr * (cv_fa_opt - pu)
      utility_mmx   <- plr * (cv_fa_mmx - pu)
      p_early_stop  <- pbinom(r1_opt, n1_opt, pu)

      results[[j]] <- list(
        power           = round(pwr * 100, 1),
        r1              = as.integer(r1_opt),  n1    = as.integer(n1_opt),
        r               = as.integer(r_opt),   n     = as.integer(n_opt),
        cv_ia           = round(cv_ia_opt,    4),
        cv_fa           = round(cv_fa_opt,    4),
        en0             = round(en0_opt,      2),
        p_early_stop    = round(p_early_stop, 4),
        utility         = round(utility_opt,  4),
        minimax_r1      = as.integer(r1_mmx),  minimax_n1  = as.integer(n1_mmx),
        minimax_r       = as.integer(r_mmx),   minimax_n   = as.integer(n_mmx),
        minimax_cv_ia   = round(r1_mmx / n1_mmx, 4),
        minimax_cv_fa   = round(cv_fa_mmx,        4),
        minimax_utility = round(utility_mmx,       4)
      )
    }, error = function(e) {
      results[[j]] <<- NULL
    })
  }

  results <- Filter(Negate(is.null), results)

  if (length(results) == 0) {
    return(list(
      feasible = FALSE,
      error    = "No feasible design found. Try increasing nmax or adjusting parameters."
    ))
  }

  utilities <- sapply(results, `[[`, "utility")
  opt_idx   <- which.max(utilities)

  list(
    feasible = TRUE,
    results  = results,
    optimal  = results[[opt_idx]]
  )
}
```

- [ ] **Step 3: Start the R API locally and smoke-test the endpoint**

```bash
cd "/Users/gabe/Desktop/Files/STARTUPS/AZ R&D Intersect Platform/gs-intersect/api"
Rscript run.R &
sleep 3
curl -s -X POST http://localhost:8000/simon \
  -H "Content-Type: application/json" \
  -d '{"pu":0.3,"pa":0.5,"ep1":0.1,"nmax":150}' | head -c 500
```

Expected: JSON with `feasible: true`, `results` array of 21 objects, `optimal` object containing `power`, `r1`, `n1`, `r`, `n`, `cv_ia`, `cv_fa`, `en0`, `p_early_stop`, `utility`, and minimax comparison fields.

- [ ] **Step 4: Test infeasible case**

```bash
curl -s -X POST http://localhost:8000/simon \
  -H "Content-Type: application/json" \
  -d '{"pu":0.4,"pa":0.5,"ep1":0.1,"nmax":10}'
```

Expected: `{"feasible":false,"error":"No feasible design found..."}`

- [ ] **Step 5: Commit**

```bash
cd "/Users/gabe/Desktop/Files/STARTUPS/AZ R&D Intersect Platform/gs-intersect"
git add api/plumber.R
git commit -m "feat(api): add /simon endpoint using clinfun::ph2simon"
```

---

## Task 2: TypeScript types and API functions

**Files:**
- Modify: `lib/api.ts` (append only — do not touch existing exports)

- [ ] **Step 1: Append Simon interfaces and functions to lib/api.ts**

At the end of `lib/api.ts`, after the existing `exportCSV` function, add:

```typescript
// ── Simon 2-Stage ─────────────────────────────────────────────────────────────

export interface SimonInputs {
  pu:   number;
  pa:   number;
  ep1:  number;
  nmax: number;
}

export interface SimonResult {
  power:           number;
  r1:              number;
  n1:              number;
  r:               number;
  n:               number;
  cv_ia:           number;
  cv_fa:           number;
  en0:             number;
  p_early_stop:    number;
  utility:         number;
  minimax_r1:      number;
  minimax_n1:      number;
  minimax_r:       number;
  minimax_n:       number;
  minimax_cv_ia:   number;
  minimax_cv_fa:   number;
  minimax_utility: number;
}

export interface SimonResponse {
  results:  SimonResult[];
  optimal:  SimonResult;
  feasible: boolean;
  error?:   string;
}

export function simonInputsToParams(inputs: SimonInputs): URLSearchParams {
  const p = new URLSearchParams();
  p.set("pu",   String(inputs.pu));
  p.set("pa",   String(inputs.pa));
  p.set("ep1",  String(inputs.ep1));
  p.set("nmax", String(inputs.nmax));
  return p;
}

export function simonParamsToInputs(params: URLSearchParams): SimonInputs | null {
  if (!params.has("pu")) return null;
  return {
    pu:   parseFloat(params.get("pu")  ?? "0.3"),
    pa:   parseFloat(params.get("pa")  ?? "0.5"),
    ep1:  parseFloat(params.get("ep1") ?? "0.1"),
    nmax: parseInt(params.get("nmax")  ?? "150"),
  };
}

export async function runSimon(inputs: SimonInputs): Promise<SimonResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/simon`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(inputs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.feasible) {
    throw new Error(data.error ?? "No feasible design found.");
  }
  const coerce = (r: Record<string, unknown>): SimonResult => ({
    power:           Number(r.power),
    r1:              Number(r.r1),    n1:    Number(r.n1),
    r:               Number(r.r),     n:     Number(r.n),
    cv_ia:           Number(r.cv_ia), cv_fa: Number(r.cv_fa),
    en0:             Number(r.en0),
    p_early_stop:    Number(r.p_early_stop),
    utility:         Number(r.utility),
    minimax_r1:      Number(r.minimax_r1),  minimax_n1:      Number(r.minimax_n1),
    minimax_r:       Number(r.minimax_r),   minimax_n:       Number(r.minimax_n),
    minimax_cv_ia:   Number(r.minimax_cv_ia),
    minimax_cv_fa:   Number(r.minimax_cv_fa),
    minimax_utility: Number(r.minimax_utility),
  });
  return {
    feasible: true,
    results:  (data.results as Record<string, unknown>[]).map(coerce),
    optimal:  coerce(data.optimal as Record<string, unknown>),
  };
}

export function exportSimonRScript(inputs: SimonInputs, optimal: SimonResult): void {
  const date = new Date().toISOString().split("T")[0];
  const script = `\
########################################################################################
#
# GS-Intersect — Simon 2-Stage Validation Script
# Generated: ${date}
#
# Reproduces the utility optimisation for the Simon 2-stage design using clinfun::ph2simon.
# Run in R to validate the output from the web interface.
#
########################################################################################

library(clinfun)

# ── Parameters ────────────────────────────────────────────────────────────────

pu   <- ${inputs.pu}     # unacceptable response rate (H0)
pa   <- ${inputs.pa}     # target response rate (H1)
ep1  <- ${inputs.ep1}    # type I error (alpha)
nmax <- ${inputs.nmax}   # maximum sample size

# ── Power sweep ───────────────────────────────────────────────────────────────

ep2_seq <- c(0.01, seq(0.05, 0.95, 0.05), 0.99)
lep2    <- length(ep2_seq)

utility <- rep(NA, lep2)
n_fa    <- rep(NA, lep2)
cv_fa   <- rep(NA, lep2)

for (j in seq_len(lep2)) {
  ep2 <- ep2_seq[j]; pwr <- 1 - ep2
  out <- tryCatch(ph2simon(pu, pa, ep1, ep2, nmax)$out, error = function(e) NULL)
  if (is.null(out)) next
  opt_row      <- if (nrow(out) >= 2) which.min(out[, 5]) else 1
  r            <- out[opt_row, 3]; n <- out[opt_row, 4]
  cv_fa[j]     <- r / n
  n_fa[j]      <- n
  utility[j]   <- (pwr / ep1) * (cv_fa[j] - pu)
}

wM <- which.max(utility)
cat(sprintf("Optimal power:   %.1f%%\\n", (1 - ep2_seq[wM]) * 100))
cat(sprintf("Optimal N:       %d\\n",     n_fa[wM]))
cat(sprintf("Optimal CV_FA:   %.4f\\n",   cv_fa[wM]))
cat(sprintf("Optimal utility: %.4f\\n",   utility[wM]))

# ── Expected from GS-Intersect ────────────────────────────────────────────────
# Optimal -> Power: ${optimal.power}%, N: ${optimal.n}, CV_FA: ${optimal.cv_fa.toFixed(4)}, Utility: ${optimal.utility.toFixed(4)}
`;
  const blob = new Blob([script], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "simon-validation.R";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSimonCSV(results: SimonResult[]): void {
  const headers = [
    "Power (%)", "N1", "r1", "CV1", "N", "r", "CV_FA",
    "Utility", "EN0", "P(stop|H0) %", "Minimax N", "Minimax CV_FA",
  ];
  const rows = results.map(r => [
    r.power, r.n1, r.r1, r.cv_ia.toFixed(4), r.n, r.r, r.cv_fa.toFixed(4),
    r.utility.toFixed(4), r.en0.toFixed(2), (r.p_early_stop * 100).toFixed(2),
    r.minimax_n, r.minimax_cv_fa.toFixed(4),
  ]);
  const csv  = [headers, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "simon-results.csv";
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/gabe/Desktop/Files/STARTUPS/AZ R&D Intersect Platform/gs-intersect"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/api.ts
git commit -m "feat(api): add Simon types, runSimon, URL param and export functions"
```

---

## Task 3: NavBar, layout, and GS page header

**Files:**
- Create: `components/NavBar.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create components/NavBar.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",      label: "GS Design" },
  { href: "/simon", label: "Simon 2-Stage" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="border-b border-az-platinum bg-white/90 backdrop-blur sticky top-0 z-20 print-hidden">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-6">
        <span
          className="text-base font-bold text-az-navy shrink-0"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          GS-Intersect
        </span>
        <nav className="flex gap-1">
          {TABS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-az-mulberry text-white"
                    : "text-az-graphite hover:text-az-mulberry hover:bg-az-light-platinum"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden sm:flex items-center gap-3">
          <p className="text-xs font-medium text-az-graphite">AstraZeneca</p>
          <div
            className="w-3 h-8 rounded-sm"
            style={{ background: "linear-gradient(180deg, #830051 0%, #003865 100%)" }}
          />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Update app/layout.tsx to render NavBar above children**

Replace the entire file:

```tsx
import type { Metadata } from "next";
import { Inter, Roboto_Slab } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "GS-Intersect",
  description: "Optimal power selection for group sequential and Simon 2-stage trial design",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoSlab.variable}`}>
      <body>
        <TooltipProvider>
          <NavBar />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Remove the `<header>` block from app/page.tsx; move Share/Print into results area**

In `app/page.tsx`, delete the entire `{/* Header */}` block (lines 78–125 of the current file — the full `<header>…</header>` element).

Then, inside the `{result && !loading && (` block, replace the opening `<>` + first `<div className="space-y-3">` with a toolbar row followed by the same div:

```tsx
{result && !loading && (
  <>
    {/* Share / Print toolbar */}
    <div className="flex justify-end items-center gap-3 print-hidden">
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </Button>
        {shareToast && (
          <div className="absolute right-0 top-9 bg-az-graphite text-white text-xs rounded-md px-3 py-1.5 whitespace-nowrap shadow-lg animate-slide-in">
            Link copied!
          </div>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrint}
        className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs"
      >
        <Printer className="w-3.5 h-3.5" />
        Export PDF
      </Button>
    </div>

    <div className="space-y-3">
      {/* ... rest of the charts/cards/table unchanged ... */}
```

The rest of the `{result && !loading && ...}` block (UtilityChart, OptimalCard, ResultsTable, RawOutput) is unchanged.

Also update the `<main>` element to remove the top padding that previously sat below the sticky header:

Change `className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-8"` on `<main>` to `className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6"`.

And remove the per-page `<footer>` from `app/page.tsx` (lines 219–225) since NavBar now provides branding — the footer's only content was "GS-Intersect" + "Powered by gsDesign (R)" which can live in the Simon page's footer if wanted, or be dropped.

- [ ] **Step 4: Start dev server and verify visually**

```bash
npm run dev
```

Open http://localhost:3000. Check:
- NavBar appears at top with "GS-Intersect" logo, "GS Design" (active, mulberry bg) and "Simon 2-Stage" tabs
- No double header — old title block is gone
- Run optimization; verify Share/Print buttons appear in the results area
- Navigate to http://localhost:3000/simon — should 404 (not yet built), but NavBar should show "Simon 2-Stage" active

- [ ] **Step 5: Commit**

```bash
git add components/NavBar.tsx app/layout.tsx app/page.tsx
git commit -m "feat(nav): add NavBar with GS/Simon tabs; move Share/Print into results toolbar"
```

---

## Task 4: SimonInputPanel

**Files:**
- Create: `components/SimonInputPanel.tsx`

- [ ] **Step 1: Create components/SimonInputPanel.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Loader2 } from "lucide-react";
import type { SimonInputs } from "@/lib/api";

interface Props {
  onRun:          (inputs: SimonInputs) => void;
  loading:        boolean;
  initialValues?: Partial<SimonInputs>;
}

function FieldLabel({ label, tooltip, error }: { label: string; tooltip: string; error?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className={`text-xs font-medium ${error ? "text-red-500" : "text-az-graphite"}`}>
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger>
          <Info className={`w-3 h-3 cursor-help ${error ? "text-red-400" : "text-az-platinum"}`} />
        </TooltipTrigger>
        <TooltipContent className="max-w-56 text-xs bg-az-graphite border-az-graphite text-white">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function SimonInputPanel({ onRun, loading, initialValues }: Props) {
  const [pu,        setPu]        = useState("0.30");
  const [pa,        setPa]        = useState("0.50");
  const [ep1,       setEp1]       = useState("0.10");
  const [nmax,      setNmax]      = useState("150");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!initialValues) return;
    if (initialValues.pu   !== undefined) setPu(String(initialValues.pu));
    if (initialValues.pa   !== undefined) setPa(String(initialValues.pa));
    if (initialValues.ep1  !== undefined) setEp1(String(initialValues.ep1));
    if (initialValues.nmax !== undefined) setNmax(String(initialValues.nmax));
  }, [initialValues]);

  const getInvalidFields = (): Set<string> => {
    if (!submitted) return new Set();
    const s    = new Set<string>();
    const puV  = parseFloat(pu);
    const paV  = parseFloat(pa);
    const ep1V = parseFloat(ep1);
    const nmV  = parseInt(nmax);

    if (isNaN(puV)  || puV  <= 0 || puV  >= 1)                s.add("pu");
    if (isNaN(paV)  || paV  <= 0 || paV  >= 1)                s.add("pa");
    if (!isNaN(puV) && !isNaN(paV) && paV <= puV)              s.add("pa");
    if (isNaN(ep1V) || ep1V < 0.01 || ep1V > 0.20)            s.add("ep1");
    if (isNaN(nmV)  || nmV  < 10   || nmV  > 1000)            s.add("nmax");
    return s;
  };

  const invalidFields = getInvalidFields();

  const handleRun = () => {
    setSubmitted(true);
    const puV  = parseFloat(pu);
    const paV  = parseFloat(pa);
    const ep1V = parseFloat(ep1);
    const nmV  = parseInt(nmax);

    const valid =
      !isNaN(puV)  && puV  > 0 && puV < 1 &&
      !isNaN(paV)  && paV  > puV && paV < 1 &&
      !isNaN(ep1V) && ep1V >= 0.01 && ep1V <= 0.20 &&
      !isNaN(nmV)  && nmV  >= 10  && nmV  <= 1000;

    if (!valid) return;
    onRun({ pu: puV, pa: paV, ep1: ep1V, nmax: nmV });
  };

  const inputClass = "bg-white border-az-platinum text-az-graphite text-xs h-8 focus:border-az-mulberry focus:ring-az-mulberry/20 placeholder:text-az-platinum";
  const errorClass = "bg-red-50 border-red-400 text-az-graphite text-xs h-8 focus:border-red-400 focus:ring-red-100 placeholder:text-red-300";
  const ic = (name: string) => invalidFields.has(name) ? errorClass : inputClass;

  return (
    <Card className="bg-white border-az-light-platinum shadow-sm h-fit print-hidden">
      <CardHeader className="pb-3 border-b border-az-light-platinum">
        <CardTitle className="text-sm font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Design Parameters
        </CardTitle>
        <p className="text-[10px] text-az-platinum mt-0.5">
          Phase 2 · Single-Arm · Binary Endpoint
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">

        <div className="space-y-1.5">
          <FieldLabel
            label="Unacceptable response rate (H₀)"
            tooltip="Response rate the drug must beat to be considered promising. Below this, the drug is unacceptable."
            error={invalidFields.has("pu")}
          />
          <Input
            value={pu}
            onChange={e => setPu(e.target.value)}
            className={ic("pu")}
            placeholder="0.30"
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel
            label="Target response rate (H₁)"
            tooltip="Response rate we want to detect with the specified power. Must be greater than the unacceptable rate."
            error={invalidFields.has("pa")}
          />
          <Input
            value={pa}
            onChange={e => setPa(e.target.value)}
            className={ic("pa")}
            placeholder="0.50"
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel
            label="Type I error (α)"
            tooltip="Maximum probability of declaring the drug promising when it isn't. Typical range: 0.05–0.10."
            error={invalidFields.has("ep1")}
          />
          <Input
            value={ep1}
            onChange={e => setEp1(e.target.value)}
            className={ic("ep1")}
            placeholder="0.10"
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel
            label="Max sample size"
            tooltip="Search limit for ph2simon. Increase if no feasible design is found at high power levels."
            error={invalidFields.has("nmax")}
          />
          <Input
            value={nmax}
            onChange={e => setNmax(e.target.value)}
            className={ic("nmax")}
            placeholder="150"
          />
        </div>

        <Button
          onClick={handleRun}
          disabled={loading}
          className="w-full bg-az-mulberry hover:bg-az-mulberry/90 text-white font-semibold gap-2 mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Computing…
            </>
          ) : (
            "Run Optimization"
          )}
        </Button>

        {submitted && invalidFields.size > 0 && (
          <p className="text-xs text-red-500 text-center pt-1">
            Please correct the highlighted fields above.
          </p>
        )}

        <p className="text-[10px] text-az-platinum text-center leading-relaxed pt-1">
          Sweeps 21 power levels (1%–99%) via{" "}
          <span className="font-mono">clinfun::ph2simon</span>.
          Optimal design minimises expected N under H₀.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/SimonInputPanel.tsx
git commit -m "feat(simon): add SimonInputPanel with 4-field validated form"
```

---

## Task 5: SimonOptimalCard

**Files:**
- Create: `components/SimonOptimalCard.tsx`

- [ ] **Step 1: Create components/SimonOptimalCard.tsx**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SimonResult, SimonInputs } from "@/lib/api";

interface Props {
  optimal: SimonResult;
  inputs:  SimonInputs;
}

export function SimonOptimalCard({ optimal, inputs }: Props) {
  return (
    <div className="space-y-3">
      {/* Two-card row */}
      <div className="grid grid-cols-2 gap-3">

        {/* Stage 1 card */}
        <Card className="border-az-light-platinum shadow-sm bg-white">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-semibold text-az-navy"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Stage 1 (Interim)
              </p>
              <Badge
                className="text-[10px] font-medium"
                style={{ background: "#003865", color: "#fff" }}
              >
                n₁ = {optimal.n1}
              </Badge>
            </div>

            <p className="text-sm text-az-graphite leading-snug">
              Stop early if{" "}
              <span className="font-bold text-az-navy">≤ {optimal.r1}</span>{" "}
              responses in{" "}
              <span className="font-bold text-az-navy">{optimal.n1}</span> patients
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">CV₁</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.cv_ia.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">P(stop | H₀)</p>
                <p className="text-sm font-semibold text-az-graphite">
                  {(optimal.p_early_stop * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final analysis card */}
        <Card className="border-az-light-platinum shadow-sm bg-white">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-semibold text-az-navy"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Final Analysis
              </p>
              <Badge
                className="text-[10px] font-medium"
                style={{ background: "#830051", color: "#fff" }}
              >
                {optimal.power}% power
              </Badge>
            </div>

            <p className="text-sm text-az-graphite leading-snug">
              Declare promising if{" "}
              <span className="font-bold text-az-navy">&gt; {optimal.r}</span>{" "}
              responses in{" "}
              <span className="font-bold text-az-navy">{optimal.n}</span> patients
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">CV_FA</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.cv_fa.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">Total N</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.n}</p>
              </div>
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">EN₀</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.en0.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">Utility</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.utility.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary line */}
      <p className="text-[11px] text-az-platinum text-center leading-relaxed">
        Optimal design at{" "}
        <span className="text-az-graphite font-medium">{optimal.power}%</span> power ·
        α = <span className="text-az-graphite font-medium">{inputs.ep1}</span> ·
        EN₀ = <span className="text-az-graphite font-medium">{optimal.en0.toFixed(1)}</span> ·
        P(stop&nbsp;early&nbsp;|&nbsp;H₀) = <span className="text-az-graphite font-medium">{(optimal.p_early_stop * 100).toFixed(1)}%</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/SimonOptimalCard.tsx
git commit -m "feat(simon): add SimonOptimalCard with decision rules and key metrics"
```

---

## Task 6: SimonResultsTable

**Files:**
- Create: `components/SimonResultsTable.tsx`

- [ ] **Step 1: Create components/SimonResultsTable.tsx**

```tsx
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportSimonRScript, exportSimonCSV } from "@/lib/api";
import type { SimonResult, SimonInputs } from "@/lib/api";
import { FileCode2, Table2 } from "lucide-react";

interface Props {
  results: SimonResult[];
  optimal: SimonResult;
  inputs:  SimonInputs;
}

export function SimonResultsTable({ results, optimal, inputs }: Props) {
  const isOptimal = (r: SimonResult) => r.power === optimal.power && r.n === optimal.n;

  const sorted = [...results].sort((a, b) => a.power - b.power);

  return (
    <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-az-light-platinum">
        <h3
          className="text-xs font-semibold text-az-navy"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Results — All Power Levels
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportSimonRScript(inputs, optimal)}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <FileCode2 className="w-3 h-3" />
            Export R Script
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportSimonCSV(results)}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <Table2 className="w-3 h-3" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-az-light-platinum/40">
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap"></TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">Power %</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">N₁</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">r₁</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">CV₁</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">N</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">r</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">CV_FA</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">Utility</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">EN₀</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">P(stop|H₀)%</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">Minimax N</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">Minimax CV_FA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => {
              const opt = isOptimal(r);
              return (
                <TableRow
                  key={i}
                  className={opt ? "bg-az-light-platinum/60" : "hover:bg-az-light-platinum/20"}
                >
                  <TableCell className="px-3 py-1.5 text-[10px]">
                    {opt && (
                      <span className="text-az-mulberry font-bold" title="Utility-optimal design">★</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-xs font-medium text-az-graphite">{r.power}%</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.n1}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.r1}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.cv_ia.toFixed(4)}</TableCell>
                  <TableCell className={`px-3 py-1.5 text-xs font-medium ${opt ? "text-az-mulberry" : "text-az-graphite"}`}>
                    {r.n}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.r}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.cv_fa.toFixed(4)}</TableCell>
                  <TableCell className={`px-3 py-1.5 text-xs font-semibold ${opt ? "text-az-mulberry" : "text-az-graphite"}`}>
                    {r.utility.toFixed(4)}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.en0.toFixed(1)}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{(r.p_early_stop * 100).toFixed(1)}%</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.minimax_n}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.minimax_cv_fa.toFixed(4)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/SimonResultsTable.tsx
git commit -m "feat(simon): add SimonResultsTable with export R script and CSV"
```

---

## Task 7: SimonChart

**Files:**
- Create: `components/SimonChart.tsx`

This is the most complex component. It plots N (total) on x-axis vs. utility on y-axis, with CV_FA on the top axis and power% on the right axis. Patterns copied from `UtilityChart.tsx`: `mounted` gate, dynamic Plotly import, `getPlotly()`, ghost yaxis2 trace, vline with `hoverinfo:"skip"`, pixel-gap yaxis2 algorithm, `downloadPngWithMeta`.

- [ ] **Step 1: Create components/SimonChart.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { RotateCcw, ImageDown } from "lucide-react";
import type { SimonResult, SimonInputs } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  results: SimonResult[];
  optimal: SimonResult;
  inputs:  SimonInputs;
}

const CURVE_COLOR   = "#003865";   // AZ navy
const VLINE_COLOR   = "#830051";   // AZ mulberry

const baseAxis = {
  gridcolor:     "#ebefee",
  linecolor:     "#9db0ac",
  tickfont:      { color: "#9db0ac", size: 10 },
  zerolinecolor: "#ebefee",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPlotly = () => (window as any).Plotly;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vline = (x: number, yRange: number[], color: string, dash: "solid" | "dash"): any => ({
  x: [x, x], y: [yRange[0], yRange[1]],
  type: "scatter", mode: "lines",
  line:      { color, width: dash === "solid" ? 2 : 1.5, dash },
  hoverinfo: "skip" as const,
  showlegend: false, xaxis: "x", yaxis: "y",
});

const yHeadroom = (arr: number[]) => {
  const mn = Math.min(...arr), mx = Math.max(...arr), sp = mx - mn || 1;
  return [mn - sp * 0.06, mx + sp * 0.18];
};

export function SimonChart({ results, optimal, inputs }: Props) {
  const [chartDiv, setChartDiv] = useState<HTMLElement | null>(null);
  const [mounted,  setMounted]  = useState(false);
  useEffect(() => setMounted(true), []);

  // Sort by N ascending so the line draws correctly
  const sorted = [...results].sort((a, b) => a.n - b.n);

  const ns       = sorted.map(r => r.n);
  const utils    = sorted.map(r => r.utility);
  const cvLabels = sorted.map(r => r.cv_fa.toFixed(4));
  const powers   = sorted.map(r => `${r.power}%`);
  const customData = sorted.map(r => [r.r1, r.n1, r.r, r.cv_fa, r.en0, r.p_early_stop]);

  const xPad = [Math.min(...ns) * 0.95, Math.max(...ns) * 1.02];
  const yRange = yHeadroom(utils);

  // ── Pixel-gap yaxis2 (power % on right axis) ──────────────────────────────
  // Same algorithm as UtilityChart: greedy forward pass enforcing minGap,
  // then force-include the optimal point.
  const sortedByUtil = [...sorted].sort((a, b) => a.utility - b.utility);
  const ySpan  = yRange[1] - yRange[0];
  const minGap = ySpan > 0 ? (14 * ySpan) / 214 : 0;
  const optUtil = optimal.utility;

  const greedy: SimonResult[] = [];
  let lastU = -Infinity;
  for (const r of sortedByUtil) {
    if (r.utility - lastU >= minGap) { greedy.push(r); lastU = r.utility; }
  }
  let thinned = greedy;
  if (!greedy.some(r => Math.abs(r.utility - optUtil) < 1e-9)) {
    const optRow = sortedByUtil.find(r => Math.abs(r.utility - optUtil) < 1e-9);
    if (optRow) {
      const withOpt = [...greedy, optRow].sort((a, b) => a.utility - b.utility);
      thinned = withOpt.filter(r => {
        const isOpt = Math.abs(r.utility - optUtil) < 1e-9;
        return isOpt || Math.abs(r.utility - optUtil) >= minGap;
      });
    }
  }

  // ── Plotly traces ──────────────────────────────────────────────────────────
  const data = [
    // Vertical reference line at optimal N (behind curve)
    vline(optimal.n, yRange, VLINE_COLOR, "solid"),

    // Main utility curve
    {
      x: ns, y: utils,
      type: "scatter", mode: "lines+markers",
      line:   { color: CURVE_COLOR, width: 2.5 },
      marker: { color: CURVE_COLOR, size: 6 },
      text:   powers,
      customdata: customData,
      hovertemplate:
        "<b>Power: %{text}</b><br>" +
        "N: %{x}<br>" +
        "r₁ / n₁: %{customdata[0]} / %{customdata[1]}<br>" +
        "r / n: %{customdata[2]} / %{x}<br>" +
        "CV_FA: %{customdata[3]:.4f}<br>" +
        "EN₀: %{customdata[4]:.1f}<br>" +
        "P(stop|H₀): %{customdata[5]:.2%}<br>" +
        "Utility: %{y:.4f}" +
        "<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },

    // Invisible anchor trace forces Plotly to render xaxis2 (CV top axis)
    {
      x: ns, y: ns.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },

    // Ghost trace forces Plotly to render yaxis2 (power% right axis)
    {
      x: [null], y: [null],
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 0 }, showlegend: false,
      xaxis: "x", yaxis: "y2", hoverinfo: "skip" as const,
    },
  ];

  const layout = {
    paper_bgcolor: "transparent",
    plot_bgcolor:  "#f8faf9",
    showlegend:    false,
    font:   { family: "Inter, sans-serif", color: "#3f4444" },
    margin: { t: 76, r: 56, b: 50, l: 72 },
    hovermode: "closest",
    xaxis: {
      ...baseAxis,
      title: { text: "Total N" },
      range: xPad,
    },
    xaxis2: {
      overlaying: "x", side: "top", matches: "x",
      tickvals:  ns, ticktext: cvLabels,
      tickangle: -45,
      tickfont:  { color: CURVE_COLOR, size: 9 },
      title: { text: "Critical Value FA (CV_FA)", font: { color: CURVE_COLOR, size: 10 } },
      range: xPad, showgrid: false, zeroline: false,
      showline: true, linecolor: CURVE_COLOR, ticks: "outside",
    },
    yaxis: {
      ...baseAxis,
      title: { text: "Utility Score" },
      range: yRange,
    },
    yaxis2: {
      overlaying: "y", side: "right",
      range: yRange,
      tickvals: thinned.map(r => r.utility),
      ticktext: thinned.map(r => `${r.power.toFixed(1)}%`),
      tickfont: { color: CURVE_COLOR, size: 9 },
      title: { text: "Power %", font: { color: CURVE_COLOR, size: 10 } },
      showgrid: false, zeroline: false,
      showline: true, linecolor: CURVE_COLOR, ticks: "outside",
    },
  };

  // ── Zoom: update CV tick density ──────────────────────────────────────────
  const handleRelayout = (relayoutData: Record<string, unknown>) => {
    if (!chartDiv || !getPlotly()) return;
    const hasRange     = relayoutData["xaxis.range[0]"] !== undefined;
    const hasAutorange = !!relayoutData["xaxis.autorange"];
    if (!hasRange && !hasAutorange) return;

    const lo = hasRange ? Number(relayoutData["xaxis.range[0]"]) : xPad[0];
    const hi = hasRange ? Number(relayoutData["xaxis.range[1]"]) : xPad[1];

    const labelMap = new Map(ns.map((n, i) => [n, cvLabels[i]]));
    const visible  = ns.filter(n => n >= lo && n <= hi);
    const stride   = visible.length > 12 ? 3 : visible.length > 6 ? 2 : 1;
    const strided  = visible.filter((_, i) => i % stride === 0);
    const unique   = [...new Set([...strided, ...(visible.includes(optimal.n) ? [optimal.n] : [])])].sort((a, b) => a - b);

    getPlotly().relayout(chartDiv, {
      "xaxis2.tickvals": unique,
      "xaxis2.ticktext": unique.map(n => labelMap.get(n) ?? ""),
    });
  };

  // ── PNG export ─────────────────────────────────────────────────────────────
  const handleDownloadPng = async () => {
    if (!chartDiv || !getPlotly()) return;
    const Plotly = getPlotly();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const divAny = chartDiv as any;
    const currentData   = divAny.data   ?? [];
    const currentLayout = divAny.layout ?? {};

    const title = `Simon 2-Stage · H₀: ${(inputs.pu * 100).toFixed(0)}% · H₁: ${(inputs.pa * 100).toFixed(0)}% · α = ${(inputs.ep1 * 100).toFixed(0)}%`;

    // Label the solid vline in the legend for the export
    const exportData = currentData.map((trace: Record<string, unknown>) => {
      if (
        trace.mode === "lines" &&
        Array.isArray(trace.x) &&
        (trace.x as number[]).length === 2 &&
        (trace.x as number[])[0] === (trace.x as number[])[1]
      ) {
        return { ...trace, showlegend: true, name: `Optimal N = ${optimal.n}` };
      }
      return trace;
    });

    const exportLayout = {
      ...currentLayout,
      title: {
        text: title,
        font: { family: "Inter, sans-serif", size: 13, color: "#1a2e44" },
        x: 0.5, xanchor: "center",
      },
      showlegend: true,
      legend: {
        orientation: "h", x: 0.5, xanchor: "center", y: -0.22,
        font: { family: "Inter, sans-serif", size: 10, color: "#3f4444" },
      },
      margin: {
        ...currentLayout.margin,
        b: (currentLayout.margin?.b ?? 50) + 50,
        t: (currentLayout.margin?.t ?? 76) + 40,
      },
    };

    const url: string = await Plotly.toImage(
      { data: exportData, layout: exportLayout },
      { format: "png", scale: 2, width: chartDiv.clientWidth, height: chartDiv.clientHeight + 90 },
    );
    const a = document.createElement("a");
    a.href = url; a.download = "simon-utility.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const resetView = () => {
    if (!chartDiv || !getPlotly()) return;
    getPlotly().relayout(chartDiv, { "xaxis.autorange": true, "yaxis.autorange": true });
  };

  return (
    <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CURVE_COLOR }} />
        <h3
          className="text-xs font-semibold text-az-navy"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Utility Curve
        </h3>
        <span className="text-[10px] text-az-platinum ml-auto whitespace-nowrap">
          Optimal: {optimal.power}% power · N = {optimal.n} · CV_FA = {optimal.cv_fa.toFixed(4)}
        </span>
      </div>

      <div style={{ height: "360px" }}>
        {mounted && (
          <Plot
            data={data as Plotly.Data[]}
            layout={layout as Partial<Plotly.Layout>}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "360px" }}
            onInitialized={(_, div) => setChartDiv(div)}
            onUpdate={(_, div)       => setChartDiv(div)}
            onRelayout={handleRelayout}
          />
        )}
      </div>

      <div className="flex items-center justify-between px-5 pb-4 pt-2">
        <p className="text-[10px] text-az-platinum">
          Drag to zoom · Double-click to reset
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={resetView}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleDownloadPng}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <ImageDown className="w-3 h-3" /> PNG
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/SimonChart.tsx
git commit -m "feat(simon): add SimonChart with CV top axis, power% right axis, PNG export"
```

---

## Task 8: Simon page

**Files:**
- Create: `app/simon/page.tsx`

- [ ] **Step 1: Create app/simon/page.tsx**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { SimonInputPanel }   from "@/components/SimonInputPanel";
import { SimonChart }        from "@/components/SimonChart";
import { SimonOptimalCard }  from "@/components/SimonOptimalCard";
import { SimonResultsTable } from "@/components/SimonResultsTable";
import { runSimon, simonInputsToParams, simonParamsToInputs } from "@/lib/api";
import type { SimonInputs, SimonResponse } from "@/lib/api";
import { AlertCircle, Share2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SimonPage() {
  const [result,     setResult]     = useState<SimonResponse | null>(null);
  const [lastInputs, setLastInputs] = useState<SimonInputs | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [urlInputs,  setUrlInputs]  = useState<Partial<SimonInputs> | undefined>(undefined);
  const [shareToast, setShareToast] = useState(false);
  const autoRanRef = useRef(false);

  // Read URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = simonParamsToInputs(params);
    if (parsed) setUrlInputs(parsed);
  }, []);

  // Auto-run once when URL params are ready
  useEffect(() => {
    if (!urlInputs || autoRanRef.current) return;
    autoRanRef.current = true;
    handleRun(urlInputs as SimonInputs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInputs]);

  const handleRun = async (inputs: SimonInputs) => {
    setLoading(true);
    setError(null);
    try {
      const data = await runSimon(inputs);
      setResult(data);
      setLastInputs(inputs);
    } catch (e) {
      const raw   = e instanceof Error ? e.message : "Unknown error";
      const isNet = /failed to fetch|network|load failed/i.test(raw);
      const debugId = `ERR-${Date.now().toString(36).toUpperCase()}`;
      console.error(`[GS-Intersect Simon ${debugId}]`, e);
      setError(
        isNet
          ? `Network error — the API could not be reached. Please refresh and try again.\n\nIf the problem persists, contact support with code: ${debugId}`
          : `${raw}\n\nIf this keeps happening, please refresh the page. Debug code: ${debugId}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!lastInputs) return;
    const params = simonInputsToParams(lastInputs);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    });
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

          {/* Left: inputs */}
          <SimonInputPanel onRun={handleRun} loading={loading} initialValues={urlInputs} />

          {/* Right: results */}
          <div className="space-y-6">

            {!result && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-96 rounded-xl border-2 border-dashed border-az-light-platinum text-center px-8 bg-white print-hidden">
                <div className="w-14 h-14 rounded-full bg-az-light-platinum flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-az-platinum" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-az-graphite text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  Set your design parameters
                </p>
                <p className="text-az-platinum text-xs mt-1.5 max-w-xs leading-relaxed">
                  Adjust the inputs on the left and click{" "}
                  <span className="text-az-mulberry font-medium">Run Optimization</span>{" "}
                  to find the utility-maximising Simon 2-stage design.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-az-light-platinum bg-white print-hidden">
                <div className="flex gap-1.5 mb-4">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-az-mulberry animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-az-graphite text-sm font-medium">Running optimization…</p>
                <p className="text-az-platinum text-xs mt-1">This may take a few seconds</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 print-hidden">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-red-700 font-medium">Optimization failed</p>
                  <p className="text-xs text-red-500 mt-0.5 whitespace-pre-wrap">{error}</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <>
                {/* Share / Print toolbar */}
                <div className="flex justify-end items-center gap-3 print-hidden">
                  <div className="relative">
                    <Button
                      variant="outline" size="sm"
                      onClick={handleShare}
                      className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </Button>
                    {shareToast && (
                      <div className="absolute right-0 top-9 bg-az-graphite text-white text-xs rounded-md px-3 py-1.5 whitespace-nowrap shadow-lg animate-slide-in">
                        Link copied!
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline" size="sm"
                    onClick={handlePrint}
                    className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Export PDF
                  </Button>
                </div>

                {/* Utility curve */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between print-hidden">
                    <h2 className="text-sm font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
                      Utility Curve
                    </h2>
                    <span className="text-[11px] text-az-platinum">Drag to zoom · Double-click to reset</span>
                  </div>
                  <SimonChart results={result.results} optimal={result.optimal} inputs={lastInputs!} />
                </div>

                {/* Optimal design cards */}
                <SimonOptimalCard optimal={result.optimal} inputs={lastInputs!} />

                {/* Results table */}
                <SimonResultsTable
                  results={result.results}
                  optimal={result.optimal}
                  inputs={lastInputs!}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and test full flow**

```bash
npm run dev
```

Open http://localhost:3000/simon. Verify:
1. NavBar shows "Simon 2-Stage" active (mulberry bg), "GS Design" inactive
2. SimonInputPanel renders with default values (0.30, 0.50, 0.10, 150)
3. Click "Run Optimization" — loading spinner appears, then results render
4. SimonChart shows utility curve with mulberry vertical line at optimal N
5. Top axis shows CV_FA values; right axis shows power %
6. Hover shows power, N, r1, n1, r, CV_FA, EN₀, P(stop|H₀), utility
7. SimonOptimalCard shows Stage 1 and Final cards with decision rules in plain English
8. SimonResultsTable shows all power levels; optimal row highlighted with ★
9. Share button copies URL; pasting URL into new tab auto-runs the same inputs
10. Export PNG includes title + legend
11. Export R Script downloads a `.R` file with the correct ph2simon call
12. Export CSV downloads all columns

Test infeasibility: set pu=0.4, pa=0.45, nmax=20, run → red error box shows "No feasible design found."

- [ ] **Step 4: Navigate back to GS page and verify no regressions**

Open http://localhost:3000. Verify:
1. NavBar shows "GS Design" active
2. GS optimization still works end-to-end
3. UtilityChart hover works on all IA stages (k=2, 3, 4)
4. Share/Print buttons appear in the results toolbar

- [ ] **Step 5: Commit**

```bash
git add app/simon/page.tsx
git commit -m "feat(simon): add Simon 2-stage page with full UI flow"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `/simon` R endpoint, ph2simon row 2 = optimal | Task 1 |
| `feasible: false` path | Task 1 |
| SimonInputs, SimonResult, SimonResponse types | Task 2 |
| `runSimon`, URL params, export functions | Task 2 |
| NavBar with /simon tab, AZ mulberry active | Task 3 |
| Replaces per-page title | Task 3 |
| SimonInputPanel, 4 fields, validation | Task 4 |
| SimonOptimalCard, plain-English decision rules | Task 5 |
| Stage 1 card: r1, n1, P(early stop) | Task 5 |
| Final card: r, n, EN₀, CV_FA, power, utility | Task 5 |
| Summary line with all key stats | Task 5 |
| SimonResultsTable with all columns | Task 6 |
| Optimal row highlighted (★) | Task 6 |
| Export R Script and Export CSV | Task 6 |
| SimonChart: N on x, utility on y | Task 7 |
| CV_FA on top axis (xaxis2) | Task 7 |
| Power % on right axis (pixel-gap algorithm) | Task 7 |
| Hover: all 7 data fields | Task 7 |
| Vline at optimal N (mulberry) | Task 7 |
| PNG export with title + legend | Task 7 |
| Zoom → CV tick density update | Task 7 |
| Simon page, URL params, Share, Print | Task 8 |
| Auto-run from URL | Task 8 |
| Infeasibility error surfaced | Task 8 |
| GS tool unchanged | Tasks 1–8 |

**Placeholder scan:** None found.

**Type consistency check:** `SimonResult` defined in Task 2, imported by Tasks 4–8 via `@/lib/api`. Field names (`cv_ia`, `cv_fa`, `en0`, `p_early_stop`, `minimax_*`) are consistent throughout all tasks.
