import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/GlassCard";
import { ConnectTelegram } from "@/components/watch/ConnectTelegram";
import { BOT_USERNAME } from "@/lib/telegram/api";

export const metadata: Metadata = { title: "Connect" };

export default function ConnectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Connect Bag</h1>
        <p className="text-muted">Get alerts where you already are, or use Bagcheck from an AI assistant.</p>
      </header>

      <GlassCard className="space-y-4">
        <h2 className="text-xl font-semibold">Telegram</h2>
        <p className="text-sm text-muted">
          Connect this browser&apos;s watchlist to <b>@{BOT_USERNAME}</b>. You&apos;ll get a message when a coin you watch shows a new warning sign.
          You can also chat with the bot directly:
        </p>
        <ul className="space-y-1 font-mono text-sm">
          <li>/check pepe</li>
          <li>/watch pepe</li>
          <li>/list · /unwatch pepe · /rescue · /stop</li>
        </ul>
        <ConnectTelegram />
      </GlassCard>

      <GlassCard className="space-y-4">
        <h2 className="text-xl font-semibold">AI assistants (MCP)</h2>
        <p className="text-sm text-muted">
          Use Bagcheck from Claude and other assistants through the Model Context Protocol. The server needs no API key: it calls this website&apos;s
          public API, with the same limits and the same rules (no buy or sell advice, and it refuses seed phrases and private keys).
        </p>
        <div className="space-y-1 text-sm">
          <p className="font-medium">Four tools</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li><code className="font-mono">check_token</code>: the risk report, signal by signal</li>
            <li><code className="font-mono">promise_check</code>: dated promises from the project&apos;s own pages</li>
            <li><code className="font-mono">watch_token</code>: add, remove or list watchlist coins, with Telegram alerts</li>
            <li><code className="font-mono">rescue_plan</code>: where it still trades, an estimated price impact, and official help links</li>
          </ul>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">1. Build it (Node 20 or newer)</p>
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-xs">{`git clone https://github.com/Terhemba10/bagcheck
cd bagcheck/mcp
npm install
npm run build`}</pre>
          <p className="font-medium">2. Add it to your assistant</p>
          <p className="text-muted">Claude Code:</p>
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-xs">{`claude mcp add bagcheck -- node /path/to/bagcheck/mcp/dist/index.js`}</pre>
          <p className="text-muted">Claude Desktop and other clients (in the MCP config file):</p>
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-xs">{`{
  "mcpServers": {
    "bagcheck": {
      "command": "node",
      "args": ["/path/to/bagcheck/mcp/dist/index.js"]
    }
  }
}`}</pre>
          <p className="text-muted">
            Then ask, for example: &ldquo;Check PEPE with Bagcheck&rdquo; or &ldquo;I can&apos;t sell my token, what can I do?&rdquo;
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
