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

      <GlassCard className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">AI assistants (MCP)</h2>
          <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-medium text-teal">Coming soon</span>
        </div>
        <p className="text-sm text-muted">Use Bagcheck&apos;s checks from Claude and other assistants through the Model Context Protocol. Setup instructions will appear here.</p>
      </GlassCard>
    </div>
  );
}
