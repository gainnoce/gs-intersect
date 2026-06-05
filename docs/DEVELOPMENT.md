# Development Guide

## How we build features

This project uses the **gstack superpowers** workflow for non-trivial features. The workflow is installed globally and available as slash commands in Claude Code.

### For small changes (single file, clear scope)
Just implement directly. No process overhead needed.

### For larger features (new page, new chart type, new API endpoint)

**Step 1 — Brainstorm**
```
/brainstorm
```
Or invoke `superpowers:brainstorming`. Explore the idea collaboratively, write a spec to `docs/superpowers/specs/YYYY-MM-DD-feature-name.md`, get it approved before writing any code.

**Step 2 — Plan**
Invoke `superpowers:writing-plans`. Writes a task-by-task implementation plan to `docs/superpowers/plans/YYYY-MM-DD-feature-name.md`. Each task includes exact file paths, complete code, and test/commit steps.

**Step 3 — Execute**
Invoke `superpowers:subagent-driven-development`. Dispatches a fresh subagent per task with two-stage review (spec compliance, then code quality) before marking each task complete.

### Available slash commands

| Command | When to use |
|---|---|
| `/brainstorm` | Exploring a new feature idea |
| `/plan` | Writing an implementation plan |
| `/review` | Code review against plan and standards |
| `/ship` | Pre-ship checklist |
| `/qa` | QA walkthrough |
| `/browse` | Open browser for visual testing |
| `/retro` | Post-feature retrospective |
| `/plan-ceo-review` | Business/product review of a plan |
| `/plan-eng-review` | Engineering review of a plan |

---

## Adding a new chart

All charts share a common structure. Follow this pattern:

### 1. Define the data shape in `lib/api.ts`

Add any new fields to the relevant interface. Mark optional with `?`. Add coercion in the `coerce` or `coerceStage` function.

### 2. Build the Plotly traces

```ts
const data: Plotly.Data[] = [
  // Main curve
  { x: events, y: utils, type: "scatter", mode: "lines+markers",
    line: { color: CURVE_COLOR, width: 2.5 }, marker: { color: CURVE_COLOR, size: 6 },
    showlegend: false, xaxis: "x", yaxis: "y" },
  
  // Ghost trace — forces xaxis2 to render
  { x: vals, y: vals.map(() => null as unknown as number),
    type: "scatter", mode: "markers", marker: { opacity: 0, size: 1 },
    showlegend: false, xaxis: "x2", yaxis: "y", hoverinfo: "skip" },
  
  // Ghost trace — forces yaxis2 to render
  { x: [null], y: [null], type: "scatter", mode: "markers",
    marker: { opacity: 0, size: 0 }, showlegend: false,
    xaxis: "x", yaxis: "y2", hoverinfo: "skip" },
];
```

### 3. Build the layout

Use the `singleLayout()` factory in `UtilityChart.tsx` as reference, or copy from `SimonAuxCharts.tsx` for simpler cases. Key rules:
- `tickmode: "array"` on every axis with custom `tickvals`
- Apply greedy thinning for y-axis ticks
- Apply stride thinning (~9 max) for CV top-axis ticks
- Ascending-branch restriction for right power% axis

### 4. Add zoom handler

```ts
const handleRelayout = (relayoutData: Record<string, unknown>) => {
  if (!chartDiv || !getPlotly()) return;
  const hasRange = relayoutData["xaxis.range[0]"] !== undefined;
  const hasAuto  = !!relayoutData["xaxis.autorange"];
  if (!hasRange && !hasAuto) return;
  // recompute CV ticks for visible range
};
```

### 5. Wrap in the standard card

```tsx
<div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
  <div className="flex items-center gap-2 px-5 pt-4 pb-1">
    {/* header */}
  </div>
  <div style={{ height: "360px" }}>
    {mounted && <Plot ... />}
  </div>
  <div className="flex items-center justify-between px-5 pb-4 pt-2">
    {/* Reset + PNG buttons */}
  </div>
</div>
```

---

## Adding a new R API endpoint

In `api/plumber.R`:

```r
#* Brief description
#* @post /endpoint-name
function(req) {
  body <- jsonlite::fromJSON(req$postBody)
  
  param <- as.numeric(body$param %||% default_value)
  
  results <- vector("list", n)
  for (i in seq_len(n)) {
    tryCatch({
      # computation
      results[[i]] <- list(field = value)
    }, error = function(e) {
      results[[i]] <<- NULL
    })
  }
  
  results <- Filter(Negate(is.null), results)
  
  if (length(results) == 0) {
    stop("Descriptive error message.")
  }
  
  list(results = results, optimal = results[[which.max(...)]])
}
```

Then in `lib/api.ts`:
1. Add interface for the response shape
2. Add `async function runEndpoint(inputs)` that fetches and coerces
3. Export from the file

---

## Debugging common issues

### Chart ticks not aligning with data points
Missing `tickmode: "array"` on the axis. Add it alongside `tickvals`.

### Right y-axis power% labels non-monotone
The ascending-branch filter is missing or broken. Filter sortedRows to only those where `getPower(r) <= optPower` before thinning.

### Plotly secondary axis not rendering
Missing ghost trace for that axis. Add a trace with `marker: { opacity: 0, size: 0 }` targeting the axis, with `hoverinfo: "skip"`.

### API 500 on Render
Check Render logs. Common causes:
- `gsBoundSummary()` parsing failure for edge-case parameters
- `ph2simon()` returning no feasible design within `nmax`
- R package not installed (check `render.yaml` build command)

### TypeScript build failure on Vercel
Run `npx tsc --noEmit` locally. The Vercel build runs the same check — fix all errors before pushing.

### Frontend not updating after push
Both Render and Vercel auto-deploy from `git push origin main` via GitHub App integration. If Vercel isn't deploying, check the GitHub App is still connected at vercel.com → project → Settings → Git.

---

## Testing approach

There is no automated test suite. QA is done manually:

1. Run both tools with default parameters — verify numbers match Fabio's R reference scripts
2. Test edge cases: k=2, k=3, k=4; very low/high HR; nmax constraints for Simon
3. Check all chart interactions: zoom, reset, PNG export, hover tooltips
4. Verify shareable URL round-trips (copy URL, open in new tab, confirm auto-run with same results)
5. Test the loading phases: warm server (fast, skips "computing" phase) vs cold start

Reference R scripts are in:
- `Simon2stage_utility 1.R` (Fabio's Simon reference, in parent directory)
- The exported R script from the "Export R Script" button in the GS Design tool

---

## Spec and plan history

| Date | Feature | Spec | Plan |
|---|---|---|---|
| 2026-06-01 | Simon 2-stage tool | `docs/superpowers/specs/2026-06-01-simon-2stage-design.md` | `docs/superpowers/plans/2026-06-01-simon-2stage.md` |
