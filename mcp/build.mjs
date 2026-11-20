// Bundles src/ (and the shared ../lib code it imports) into one file with no runtime dependencies.
// Packages that ../lib/** imports always resolve from mcp/node_modules, so the bundle is the same
// whether or not the website's dependencies are installed (CI checks the committed tarball).
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/index.js",
  banner: { js: "#!/usr/bin/env node" },
  alias: { "@scure/bip39": fileURLToPath(new URL("./node_modules/@scure/bip39", import.meta.url)) },
  logLevel: "info",
});
