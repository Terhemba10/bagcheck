# Status (updated 19 Nov 2026)

**Live:** https://bagcheck-azure.vercel.app (Vercel project `sanix2/bagcheck`; every push to `main` auto-deploys to production)
**Repo:** https://github.com/Terhemba10/bagcheck (public)
**CMC key:** Basic plan (15,000 credits/month). The hackathon Startup upgrade had not arrived as of 19 Nov.
**Storage:** Upstash Redis via Vercel (`KV_REST_API_URL` / `KV_REST_API_TOKEN`). Locally, without those, an in-memory store is used.
**LLM:** Google Gemini via `lib/llm` (REST, key in a header). Default `gemini-3.5-flash-lite` with minimal thinking, falling back to `gemini-flash-lite-latest` (override: `GEMINI_MODEL`). Tested 19 Nov: full Flash models timed out (>40 s) and `gemini-2.5-flash` is closed to new keys.

## Done
- **Phase a:** CMC client (`lib/cmc/*`): caching, last-good fallback, per-endpoint plan detection (1006), credit governor (`budget.ts`, Basic schedule cap on small plans), credit guard (`guard.ts`, daily cap 400 + monthly reserve 1000), evidence log + `/evidence` page, `docs/ENDPOINTS.md`, `docs/API_EVIDENCE.md`, `docs/API_FEEDBACK.md`.
- **Phase b:** design spec, tokens, UI components (`components/ui`), `/design` style guide, screenshots in `design/screens`.
- **Agent v2** (`components/agent`): R3F glass orb with High/Low quality (auto, `?quality=` / `?fps=` overrides), heartbeat, listening, scanning steps, speaking verdict, danger shield; 2D fallback with cross-fade; measured 30 fps on Intel HD 520 (`design/AGENT_PERF.md`).
- **Public-site protection:** per-IP rate limits (`lib/ratelimit.ts`), CDN caching on search, admin probe locked without `CRON_SECRET`.
- **Home:** hero, search with example chips (solid dropdown), stage cards; Watchlist/Rescue/Connect are "Coming soon" pages hidden from the nav.
- **Phase c:** "Coins worth a check" row (`lib/core/worthACheck.ts`, `/api/worth-a-check`; trending on Startup, listings fallback on Basic).
- **Coin report `/coin/[id]`:** 7 signals (`lib/core/signals.ts`), score + verdict (`lib/core/score.ts`), report builder with a 5-min cache (`lib/core/report.ts`, ~4 credits per fresh report), rate-limited `/api/report/[id]`, SSRF-safe fetch (`lib/net/safeFetch.ts`), links health (`lib/core/links.ts`). Page: Bag scans with live steps then speaks the verdict; signal cards; contract scan; DEX pools; official links.

- **Promise check:** `lib/promises/*` + `prompts/extractPromises.ts` + `/api/promises/[id]` (rate-limited, cached 24 h). Reads the official site, roadmap/whitepaper links (or `/roadmap`), focusing long pages on the roadmap section. AI extracts items; **code keeps only quotes found word-for-word on the cited page**, normalises dates, computes status, and only marks "delivered" when the quote itself says so. Timeline on the report.
- **Ask Bag (corner chat):** `components/agent/CornerAgent.tsx`, `lib/client/bagContext.ts`, `/api/chat`, `lib/chat/facts.ts`, `prompts/askBag.ts`. Answers only from the report facts; **code rejects answers with advice or numbers not in the facts** and falls back to report text. Seed phrases / private keys are blocked in the browser (never sent) and on the server (`lib/safety/secrets.ts`, BIP-39 list from `@scure/bip39`).

## Next (in order)
1. Phases d–h per `docs/PLAN.md`: watchlist + snapshots + credit-aware cron + Telegram alerts (use the stored promise checks for "date passed" alerts), rescue plan, MCP server, tests/CI/docs, video + submission.

## Known polish items
- Amber (concern) state: the bloomed core lowers the face's contrast on High quality.
- "Watch this coin" is disabled until phase d.
- PDF whitepapers aren't read yet (many projects only publish PDFs).
- Promise checks for JS-only websites return "couldn't read" honestly.

## Open questions for the user
- None blocking. The user approves pushes per change; deploys happen on push to `main`.
