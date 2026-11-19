/**
 * Writes docs/API_EVIDENCE.md from a running Bagcheck instance.
 *
 *   npm run evidence:export                       # http://localhost:3000
 *   BASE_URL=https://bagcheck.vercel.app npm run evidence:export
 */
import { writeFileSync, mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";

interface Entry {
  method: string;
  path: string;
  params: Record<string, string>;
  at: string;
  httpStatus: number;
  creditCount: number | null;
  elapsedMs: number | null;
  errorCode: number | null;
  errorMessage: string | null;
  response: unknown;
}

async function main() {
  const res = await fetch(`${base}/api/evidence?count=50`);
  if (!res.ok) throw new Error(`GET /api/evidence -> ${res.status}`);
  const s = (await res.json()) as { evidence: Entry[] };

  // One example per endpoint (newest first), successful calls preferred.
  const byPath = new Map<string, Entry>();
  for (const e of s.evidence) {
    const prev = byPath.get(e.path);
    if (!prev || (prev.httpStatus >= 300 && e.httpStatus < 300)) byPath.set(e.path, e);
  }

  const lines = [
    "# API evidence",
    "",
    `Real CoinMarketCap API calls made by Bagcheck, exported ${new Date().toISOString()} from ${base}/evidence.`,
    "Responses are trimmed (arrays cut to 3 items). The API key is sent only as a server-side header and is never logged.",
    "",
    "| Endpoint | Time (UTC) | HTTP | Credits | CMC elapsed |",
    "|---|---|---|---|---|",
    ...[...byPath.values()].map(
      (e) => `| \`${e.method} ${e.path}\` | ${e.at} | ${e.httpStatus} | ${e.creditCount ?? "?"} | ${e.elapsedMs ?? "?"} ms |`,
    ),
    "",
  ];

  for (const e of byPath.values()) {
    lines.push(
      `## \`${e.method} ${e.path}\``,
      "",
      `- Called: ${e.at}`,
      `- Params: \`${new URLSearchParams(e.params).toString() || "(none)"}\``,
      `- Status: HTTP ${e.httpStatus}, credit_count ${e.creditCount ?? "?"}${e.errorCode ? `, error ${e.errorCode} (${e.errorMessage})` : ""}`,
      "",
      "```json",
      JSON.stringify(e.response, null, 2),
      "```",
      "",
    );
  }

  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/API_EVIDENCE.md", lines.join("\n"));
  console.log(`Wrote docs/API_EVIDENCE.md (${byPath.size} endpoints)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
