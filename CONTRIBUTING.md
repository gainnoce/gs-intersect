# Contributing to GS-Intersect

## Prerequisites

- Node.js 18+
- R 4.x with packages: `plumber`, `gsDesign`, `clinfun`, `jsonlite`
- Vercel CLI: `npm i -g vercel`

## Local development

### 1. Clone and install

```bash
git clone https://github.com/gainnoce/gs-intersect.git
cd gs-intersect
npm install
```

### 2. Set up environment

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Start the R API

```bash
Rscript api/run.R
```

API runs on http://localhost:8000. Keep this terminal open.

### 4. Start the frontend

```bash
npm run dev
```

Frontend runs on http://localhost:3000.

---

## Making changes

### Frontend changes (Next.js / TypeScript)

1. Edit files in `app/`, `components/`, or `lib/`
2. Check TypeScript: `npx tsc --noEmit`
3. Test in the browser at http://localhost:3000

### Backend changes (R API)

1. Edit `api/plumber.R`
2. Restart the R API (`Ctrl+C` then `Rscript api/run.R`)
3. Test with curl or the frontend

### Adding a new API field

Always update both places:
1. `api/plumber.R` — add field to the response list
2. `lib/api.ts` — add `?: optional` field to the relevant interface, add coercion in the `coerce`/`coerceStage` function

---

## Deployment

### Deploy frontend (Vercel)

```bash
git add .
git commit -m "your message"
git push origin main
vercel deploy --prod
```

**Both steps are required.** `git push` triggers the Render R API deploy automatically. `vercel deploy --prod` must be run explicitly for the frontend.

### Deploy R API (Render)

Render auto-deploys when `api/` files change on `main`. No manual step needed.

---

## Code conventions

- **TypeScript:** strict mode, no implicit `any`
- **Comments:** only when the WHY is non-obvious — no explanatory comments
- **Colours:** use only AZ brand colours defined in `CLAUDE.md` and `tailwind.config`
- **Components:** one clear responsibility per file; prefer editing existing files over creating new ones
- **Plotly:** always set `tickmode: "array"` alongside custom `tickvals`; ghost traces required for secondary axes

## Commit messages

```
type: short description

Longer explanation if needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `style`

---

## Project contacts

- **Gabe** — product owner
- **Fabio** — AZ statistician, reviews statistical outputs and provides R reference code
