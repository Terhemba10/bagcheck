# Bagcheck: working notes for Claude Code

Bagcheck is a hackathon entry (Build with CMC, AI Agents track, deadline 9 Dec 2026 23:59 UTC, aim to be ready by 5 Dec).
Plan: `docs/PLAN.md`. Current state and next steps: **`docs/STATUS.md`** (read it first). Design system: `design/DESIGN_SPEC.md`.

## Hard rules
- **Never commit or print API keys.** Keys live only in `.env.local` (gitignored) and in Vercel env vars. Before every commit, check that the CMC and Gemini key values don't appear in staged files (`git grep --cached -F "<value>"` with the value read from `.env.local`, never echoed).
- **Code decides, AI explains.** Scores, thresholds and alerts are computed in TypeScript from CMC data. The LLM only writes explanations and extracts promises, and never invents numbers.
- Never say "buy" or "sell", and never call a coin a "scam" or "rug pull". Say "warning signs" and show the evidence. Every report and alert ends with: "Not financial advice. Bagcheck explains data. It never tells you to buy or sell."
- Promise quotes stay ≤ 15 words, with a source link. Never accept seed phrases or private keys.
- **Ask before** anything that costs money, publishes, posts or deletes. Pushing to `main` deploys to production (Vercel auto-deploy), so only push working, checked code.

## CMC credits (the key is on the free Basic plan: 15,000 credits/month, 50 calls/min)
- All CMC calls go through `lib/cmc/client.ts` (cache, plan detection, credit guard, evidence log). Never call CMC from the browser.
- Blocked on Basic (1006): market-pairs, price-performance-stats, trending. These are "Startup extras", detected at runtime. Every feature must work on Basic first.
- At the start of each phase, run one free `/v1/key/info` check (e.g. `/api/evidence?count=1`) and report whether the plan has changed to Startup. If it has: record the Startup-only endpoints in `docs/ENDPOINTS.md` and save demo snapshots for judging (see PLAN §1b).
- Keep the credit governor strict. Prefer cached data; probe new endpoints with one small call.

## Environment gotchas (Windows)
- Windows PowerShell 5.1 reads/writes files as ANSI and garbles UTF-8 (≥, →, …). Edit files with the Edit/Write tools or Python/sed in Bash, not PowerShell `Get-Content`/`Set-Content`.
- Run `npx tsx` scripts that call `page.evaluate` with the `__name` shim (see `scripts/measure-agent-fps.ts`).
- The browser pane may be hidden; hidden pages don't run requestAnimationFrame, so 3D won't render there. Use Playwright with `channel: "chrome", headless: false` for real-GPU checks.
- **Stopping servers:** `kill` in Bash only stops the `npx` wrapper on Windows; the node server keeps the port and later requests silently hit the OLD server. Stop by port owner (`Get-NetTCPConnection -LocalPort N | Stop-Process`), or use `scripts/compare-promise-runs.ps1`, which does this and prints each server's start time.
- In Python heredoc edits, `"\n"` inside TS string literals can turn into a real newline; prefer the Edit tool for lines with escapes.
- Vitest config is `vitest.config.mts`. Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to silence a warning.

## Commands
```
npm run dev             # http://localhost:3000
npm test                # unit tests (vitest)
npx tsc --noEmit        # typecheck
npx eslint .            # lint
npm run build           # production build
npm run screens         # Playwright screenshots → design/screens (needs a running server)
npx tsx scripts/check-search-hero.ts      # dropdown + hero regression check (BASE_URL=…)
npx tsx scripts/measure-agent-fps.ts      # real-Chrome fps for High/Low (server on :3123)
npm run evidence:export # docs/API_EVIDENCE.md from a running server
```

## Commit style
Clear messages describing what changed and why, ending with the co-author line the harness provides.
