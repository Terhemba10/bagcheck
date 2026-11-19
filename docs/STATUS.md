# Status (updated 19 Nov 2026)

**Live:** https://bagcheck-azure.vercel.app (Vercel project `sanix2/bagcheck`; every push to `main` auto-deploys to production)
**Repo:** https://github.com/Terhemba10/bagcheck (public)
**CMC key:** Basic plan (15,000 credits/month). The hackathon Startup upgrade had not arrived as of 19 Nov.
**Storage:** Upstash Redis via Vercel (`KV_REST_API_URL` / `KV_REST_API_TOKEN`). Locally, without those, an in-memory store is used.
**LLM:** Google Gemini (`GEMINI_API_KEY` in `.env.local` and Vercel). The adapter isn't written yet.

## Done
- **Phase a:** CMC client (`lib/cmc/*`): caching, last-good fallback, per-endpoint plan detection (1006), credit governor (`budget.ts`, Basic schedule cap on small plans), credit guard (`guard.ts`, daily cap 400 + monthly reserve 1000), evidence log + `/evidence` page, `docs/ENDPOINTS.md`, `docs/API_EVIDENCE.md`, `docs/API_FEEDBACK.md`.
- **Phase b:** design spec, tokens, UI components (`components/ui`), `/design` style guide, screenshots in `design/screens`.
- **Agent v2** (`components/agent`): R3F glass orb with High/Low quality (auto, `?quality=` / `?fps=` overrides), heartbeat, listening, scanning steps, speaking verdict, danger shield; 2D fallback with cross-fade; measured 30 fps on Intel HD 520 (`design/AGENT_PERF.md`).
- **Public-site protection:** per-IP rate limits (`lib/ratelimit.ts`), CDN caching on search, admin probe locked without `CRON_SECRET`.
- **Home:** hero, search with example chips (solid dropdown), stage cards; Watchlist/Rescue/Connect are "Coming soon" pages hidden from the nav.
- **Phase c (started):** "Coins worth a check" row (`lib/core/worthACheck.ts`, `/api/worth-a-check`; trending on Startup, listings fallback on Basic). **Committed but not pushed:** its cards link to `/coin/[id]`, which doesn't exist yet. Push together with the report page.

## Next (in order)
1. **Coin report `/coin/[id]`** (phase c): signals in `lib/core/signals/*` + `score.ts` (pure, unit-tested), Basic-first:
   dilution (circ/max, FDV/mcap), volume sanity (vol/mcap), age & momentum (date_added; 7d/30d vs market from global metrics), links health (website/socials reachable),
   contract check (`/v1/dex/security/detail`), DEX liquidity (`/v1/dex/token/pools`); exchange concentration = "Startup extra" (market-pairs).
   Overall Low/Medium/High concern computed in code ("scored on N of 7 signals"). Report API route with rate limits (`LIMITS.report`). Agent in scanning → result state, verdict spoken. "Watch this coin" button (Coming soon until phase d).
2. **Promise check** with Gemini: SSRF-safe server fetch of the official website + roadmap/docs link (`lib/promises/fetchSite.ts`), text extraction, `lib/llm/` adapter (Gemini, zod-validated JSON, prompts in `/prompts`), output `[{promise, dueDate|null, sourceUrl, quote ≤15 words}]`, cached and stored for phase d. Show as the promise timeline (`components/ui/PromiseItem.tsx`).
3. **Corner Bag chat panel:** "Ask Bag about this coin", answering only from the report data (LLM explains, never invents numbers); the corner Bag reacts to what's on screen.
4. Then phases d–h per `docs/PLAN.md` (watchlist + cron + Telegram, rescue, MCP server, tests/CI/docs, video + submission).

## Open questions for the user
- None blocking. The user approves pushes per change; deploys happen on push to `main`.
