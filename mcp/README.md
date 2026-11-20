# bagcheck-mcp

Bagcheck for AI assistants, over the Model Context Protocol (stdio). Four tools:

| Tool | What it returns |
|---|---|
| `check_token` | The risk report: 7 signals from live CoinMarketCap data, a score and a plain-English verdict |
| `promise_check` | Dated promises from the project's own website or roadmap, with ≤15-word quotes and source links |
| `watch_token` | Add, remove or list watchlist coins; links Telegram for alerts |
| `rescue_plan` | Where the coin still trades, an estimated price impact for an amount, and official help links |

It holds no API keys: it calls Bagcheck's public API (https://bagcheck-azure.vercel.app), with the same rate limits, credit guard and rules. It never gives buy or sell advice, refuses seed phrases and private keys, and ends every answer with the disclaimer.

## Run it (one command, no clone or build)

```bash
npx -y https://raw.githubusercontent.com/Terhemba10/bagcheck/main/mcp/bagcheck-mcp.tgz
```

Add it to Claude Code:

```bash
claude mcp add bagcheck -- npx -y https://raw.githubusercontent.com/Terhemba10/bagcheck/main/mcp/bagcheck-mcp.tgz
```

Claude Desktop and other clients (MCP config file):

```json
{
  "mcpServers": {
    "bagcheck": {
      "command": "npx",
      "args": ["-y", "https://raw.githubusercontent.com/Terhemba10/bagcheck/main/mcp/bagcheck-mcp.tgz"]
    }
  }
}
```

On Windows, Claude Desktop needs `"command": "cmd"` with `"args": ["/c", "npx", "-y", "https://raw.githubusercontent.com/Terhemba10/bagcheck/main/mcp/bagcheck-mcp.tgz"]`.

Needs Node.js 20 or newer. Then ask, for example: "Check PEPE with Bagcheck" or "I can't sell my token, what can I do?"

## Options

- `BAGCHECK_URL`: use another Bagcheck server (e.g. `http://localhost:3000`).
- `BAGCHECK_MCP_HOME`: where the anonymous watchlist id is stored (default `~/.bagcheck/mcp.json`; delete the file to start a new watchlist).

## Develop

```bash
npm install
npm run build        # bundles src/ into dist/index.js (no runtime dependencies)
npm run smoke        # calls every tool against the live site (a few CMC credits)
npm run pack         # rebuilds bagcheck-mcp.tgz; commit it (CI checks it matches the source)
npm run check:npx    # starts it via npx from the GitHub URL and lists the tools
```

Not financial advice. Bagcheck explains data. It never tells you to buy or sell.
