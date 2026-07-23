@AGENTS.md

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

---

## GS-Intersect Project Instructions

Read this entire section before making any changes. It overrides generic instincts.

### What this project is

Clinical trial design tool. Two pages:
- `/` — Group Sequential survival design (gsDesign R package)
- `/simon` — Simon 2-stage binary endpoint design (clinfun R package)

The primary collaborator reviewing outputs is **Fabio**, a statistician. He provides R reference code that the tool must match exactly.

### Deployment — one step

```bash
git push origin main
```

This triggers both Render (R API) and Vercel (frontend) automatically via GitHub App integration. GitHub Actions also runs `tsc --noEmit` on every push to catch type errors before they reach production.

### AZ brand colours — use these, never invent new ones

```
#003865  AZ navy       — primary curves, headers
#830051  AZ mulberry   — optimal markers, hover states, CTA
#9db0ac  AZ platinum   — secondary text, borders, gridlines
#ebefee  AZ light platinum — backgrounds, subtle borders
#3f4444  AZ graphite   — body text
```

For multi-stage IA colours: `["#6366f1", "#7c3aed", "#9333ea"]` (indigo family)  
FA colour: `#10b981` (green)  
Optimal star colours: `["#f43f5e", "#fb7185", "#ec4899"]` (rose family) and `#f97316` (orange for FA)

### Chart system — read before touching any chart

All charts use the same 4-axis Plotly structure:
- `xaxis` (bottom) — events or total N
- `xaxis2` (top, `overlaying: "x"`) — critical value (HR for GS, ORR% for Simon)
- `yaxis` (left) — utility score / LR(+) / MDE
- `yaxis2` (right, `overlaying: "y"`) — power %

**Critical Plotly rules:**
- Always set `tickmode: "array"` on any axis with custom `tickvals` — without it Plotly ignores them
- Ghost traces are required to force Plotly to render `xaxis2` and `yaxis2` (see existing charts for pattern)
- Right y-axis (power%) uses ascending-branch restriction: only rows where `power ≤ optimal power`, so labels read monotonically upward

**Y-axis tick thinning (greedy pixel-gap algorithm):**
```ts
const minGap = (pixelBudget * ySpan) / plotHeight;
// plotHeight ≈ 214px for 360px card with margins {t:76, r:56, b:50, l:72}
// plotHeight ≈ 296px for 460px overlay with margins {t:112, r:60, b:52, l:62}
```
Ticks are greedily selected so no two are closer than `minGap` in data units. Always include the optimal point.

**Top x-axis (CV) tick thinning:**
```ts
const cvStride = Math.max(1, Math.ceil(ns.length / 9));  // ~9 ticks max
```

### R API patterns

The R API is a single file: `api/plumber.R`. Both endpoints live there.

When adding a new endpoint:
1. Define it with `#* @post /endpoint-name`
2. Parse body with `jsonlite::fromJSON(req$postBody)`
3. Use `%||%` for defaults (defined at bottom of file)
4. Wrap per-iteration work in `tryCatch` — failed iterations are silently dropped
5. Return a plain `list()` — Plumber serialises to JSON automatically

Render cold starts can take up to 50 seconds. This is expected and communicated to users via the loading indicator.

### TypeScript conventions

- No `any` without `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment
- All API response fields that may be absent use `?: optional` types
- Coerce API response values with `Number()` explicitly — R sometimes returns integers as strings
- `lib/api.ts` contains all types, API calls, and export functions — add new API fields there first

### What NOT to do

- Do not add comments explaining what code does — only add comments for non-obvious WHY
- Do not create new colour variables — use the AZ palette above
- Do not modify `SimonChart.tsx` when asked to change the aux charts (`SimonAuxCharts.tsx`) — they are separate components
- Do not skip `vercel deploy --prod` — git push alone does not deploy the frontend
- Do not change the R power sweep without confirming it matches Fabio's reference script
- Do not use `tickvals` without also setting `tickmode: "array"` on the same axis

### Superpowers workflow (for larger features)

This project uses the gstack superpowers skill system. For any non-trivial feature:

1. `/brainstorm` — explore the idea, write a spec to `docs/superpowers/specs/`
2. `/plan` (or invoke `superpowers:writing-plans`) — write an implementation plan to `docs/superpowers/plans/`
3. Invoke `superpowers:subagent-driven-development` to execute the plan task-by-task with spec + quality review after each task

For small changes (single file, clear scope) — just implement directly without the full workflow.

Available slash commands: `/plan-ceo-review`, `/plan-eng-review`, `/review`, `/ship`, `/qa`, `/browse`, `/retro`

### Key files at a glance

| File | Purpose |
|---|---|
| `api/plumber.R` | Both R endpoints — edit here for backend changes |
| `lib/api.ts` | All TypeScript types + API calls — update types here first |
| `components/UtilityChart.tsx` | GS Design charts (complex — read fully before editing) |
| `components/SimonChart.tsx` | Simon utility curve |
| `components/SimonAuxCharts.tsx` | Simon LR(+) and MDE charts |
| `components/LoadingProgress.tsx` | Shared 3-phase loading indicator |
| `app/page.tsx` | GS Design page |
| `app/simon/page.tsx` | Simon 2-stage page |

### Where to look when something breaks

- **Chart not showing custom ticks** → missing `tickmode: "array"` on that axis
- **Right y-axis power% labels non-monotone** → ascending-branch filter missing or broken
- **API returns 500** → check Render logs; likely R package missing or parse error in `gsBoundSummary`
- **Vercel build fails** → run `npx tsc --noEmit` locally first
- **Frontend not updating after push** → ran `git push` but forgot `vercel deploy --prod`
