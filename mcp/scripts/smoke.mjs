// Smoke test: start the built MCP server over stdio, list its tools and call
// each one against the live Bagcheck API (--offline: tools list and the
// secret blocker only). Costs a few CMC credits (cached
// reports cost 0). Usage: npm run build && npm run smoke
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DISCLAIMER = "Not financial advice.";
const home = mkdtempSync(join(tmpdir(), "bagcheck-mcp-smoke-"));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [new URL("../dist/index.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")],
  env: { ...process.env, BAGCHECK_MCP_HOME: home },
});
const client = new Client({ name: "bagcheck-smoke", version: "0.0.1" });
await client.connect(transport);

let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
};
const text = (r) => (r.content ?? []).map((c) => c.text ?? "").join("\n");

const { tools } = await client.listTools();
check(
  ["check_token", "promise_check", "watch_token", "rescue_plan"].every((n) => tools.some((t) => t.name === n)),
  `lists 4 tools (${tools.map((t) => t.name).join(", ")})`,
);

async function call(name, args, expect) {
  const t0 = Date.now();
  const r = await client.callTool({ name, arguments: args });
  const out = text(r);
  const ms = Date.now() - t0;
  check(!r.isError && out.includes(DISCLAIMER) && expect.test(out), `${name}(${JSON.stringify(args)}) in ${ms} ms`);
  if (process.env.SMOKE_VERBOSE || r.isError) console.log(out.slice(0, 1500) + "\n---");
  return out;
}

// --offline (used in CI): no calls to the live site, so no CMC credits
if (!process.argv.includes("--offline")) {
  await call("check_token", { coin: "pepe" }, /Pepe/i);
  await call("rescue_plan", { coin: "pepe", amount_usd: 5000 }, /estimate/i);
  await call("watch_token", { action: "list" }, /watchlist/i);
  await call("promise_check", { coin: "bitcoin" }, /promise|commitment|roadmap|couldn/i);
}

// the secret blocker must refuse a seed phrase without calling the API
const seed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const blocked = await client.callTool({ name: "check_token", arguments: { coin: seed } });
check(/seed phrase|private key|secret/i.test(text(blocked)), "refuses a seed phrase");

await client.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
