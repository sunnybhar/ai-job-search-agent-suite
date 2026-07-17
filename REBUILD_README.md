# Job Search Suite v4.0 — Rebuild Notes & Migration Guide

## What was rebuilt and why

| File | Change |
|---|---|
| `api/claude.js` | **NEW** — serverless proxy. Your API key was extractable from the deployed bundle (REACT_APP_ vars are baked in at build time). Now it lives server-side only. |
| `ResumeTailorAgent_Sunny.jsx` | Full rebuild. Deterministic before/after scoring, analysis→rewrite chained, fact-check pass, file upload, saved base resume, history, DOCX export in your real layout. |
| `ResumeTailorAgent_Tanya.jsx` | Same rebuild with Tanya's candidate context, role archetypes, and her resume layout (ruled section headers). |
| `CoverLetterAgent.jsx` | Full rebuild. Dymax letter = embedded gold standard, McKinsey storytelling layer, REAL web search for company news, Stories & Context input, 3 emphasis versions, delimiter output (no fragile JSON), DOCX export in your letter format, history. |
| `ATSScannerAgent.jsx` | Fixes: stemmer bug (missed real matches like operations/operation), removed 8s of hardcoded sleeps, parallelized 3 AI steps, truncation limit raised 8k→16k chars with a warning instead of silent cutting, routed through proxy. |

## Migration steps — do these in order

### 1. Install the one new dependency
```bash
cd your-project-folder
npm install docx
```
(`pdfjs-dist` and `mammoth` are already installed from the Scanner build.)

### 2. Place the files
- The 4 `.jsx` files → replace the old ones in `src/`
- `api/claude.js` → create an `api` folder at the **repo root** (next to `src/`, NOT inside it) and put the file there. Vercel automatically serves it as a serverless function at `/api/claude`.

### 3. Fix the environment variables in Vercel
Vercel → your project → Settings → Environment Variables:
- **ADD** `ANTHROPIC_API_KEY` = your key (no REACT_APP_ prefix — this stays server-side)
- **DELETE** `REACT_APP_ANTHROPIC_KEY` (this one leaks into the public bundle)

### 4. Push and redeploy
```bash
git add .
git commit -m "v4.0 rebuild: proxy, deterministic scoring, cover letter format, scanner fixes"
git push origin main
```

### 5. REVOKE your old API key — not optional
Your current deployed bundle contains the old key in plain text. Anyone who has ever had your Vercel URL can extract it. After the new deploy works:
- Go to console.anthropic.com → API Keys → revoke the old key → create a fresh one → set it as `ANTHROPIC_API_KEY` in Vercel → redeploy.

### 6. ⚠️ The other 4 agents will break — expected
BehavioralCoach, FollowUpAgent, CoffeeChatAgent, StartupEmailAgent still call the API directly with `REACT_APP_ANTHROPIC_KEY`, which no longer exists after step 3. Each needs the same small change: replace the fetch to `https://api.anthropic.com/v1/messages` (and its 3 header lines) with a fetch to `/api/claude` with only the Content-Type header. Until then, don't delete the env var if you need those agents daily — but know the key stays exposed until you do.

### 7. Local development
`npm start` does NOT serve the `/api` folder — that's a Vercel feature. For local testing:
```bash
npm install -g vercel
vercel login
vercel env pull        # pulls ANTHROPIC_API_KEY into .env.local
vercel dev             # runs CRA + the /api function together
```
Or just test on the deployed Vercel URL (auto-deploys ~60s after each push).

## How the new Resume Tailor pipeline works
1. **JD keywords** extracted by Sonnet as plain text lines (`category :: keyword`) — no JSON risk
2. **Before score** — deterministic keyword-coverage math on your original resume (same engine as the Scanner, stemmer fixed)
3. **Rewrite plan** — Opus builds the plan grounded in the real coverage report (it's told exactly what's matched/missing — no guessing)
4. **Rewrite** — Opus implements that specific plan, so the audit describes the actual output
5. **After score** — same deterministic math on the rewrite. Re-running gives the same numbers.
6. **Fact check** — Sonnet lists every quantified claim in the rewrite and flags anything not grounded in your original. Red flags = review before sending.

The scores measure keyword presence, not interview odds. A 90% with fabricated-looking bullets loses to an 80% that reads true.

## Cover Letter notes
- **Web search** runs automatically unless you fill the Company Detail override. If no verifiable recent news exists, the letter says so and uses a JD detail — it will never invent news again.
- **Stories & Context** box: paste networking conversations, stories, firm frameworks per application. Version 3 (Narrative & Mission) uses this material hardest.
- The header block (name/date/recipient/Position line) is assembled by code, not the model — exact Dymax format every time.
- Web search costs ~1–2 cents per run on top of normal token costs.

## Things to know
- **Saved base resume + history live in browser localStorage** — per browser, per device. Tanya's saved resume on her laptop won't appear on yours (by design).
- The Cover Letter agent auto-loads the base resume you saved in **your** Resume Tailor.
- DOCX header details (name, headline, contact line) are constants named `PROFILE` / `DEFAULTS` at the top of each file — edit them there.
- The proxy only allows `claude-opus-4-8` and `claude-sonnet-4-6` and caps max_tokens at 10,000 — a light abuse guard since the endpoint itself is public.
