// Starts the server the way a judge would (npx + a tarball spec) and lists its tools.
// Usage: node scripts/npx-check.mjs <tarball path or URL>
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const spec = process.argv[2] ?? "https://raw.githubusercontent.com/Terhemba10/bagcheck/main/mcp/bagcheck-mcp.tgz";
const win = process.platform === "win32";
const transport = new StdioClientTransport({
  command: win ? "cmd" : "npx",
  args: win ? ["/c", "npx", "-y", spec] : ["-y", spec],
  stderr: "inherit",
});
const client = new Client({ name: "npx-check", version: "0.0.1" });
const t0 = Date.now();
await client.connect(transport);
const { tools } = await client.listTools();
console.log(`started in ${Date.now() - t0} ms; tools: ${tools.map((t) => t.name).join(", ")}`);
await client.close();
process.exit(tools.length === 4 ? 0 : 1);
