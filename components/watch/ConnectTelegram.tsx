"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconExternal } from "@/components/ui/icons";

/** Creates a one-time link that connects this browser's watchlist to a Telegram chat. */
export function ConnectTelegram({ linked = false }: { linked?: boolean }) {
  const [link, setLink] = useState<{ url: string; bot: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (linked) {
    return (
      <p className="flex items-center gap-2 text-sm text-ok">
        <IconCheck className="size-4" /> Telegram is connected: alerts for your watchlist go to your chat with Covex.
      </p>
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/telegram/link", { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok && body?.url) setLink(body);
    else setError("Couldn't create a link right now. Please try again.");
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {!link ? (
        <Button onClick={create} disabled={busy}>
          {busy ? "Creating link…" : "Connect Telegram"}
        </Button>
      ) : (
        <div className="space-y-2">
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-teal px-4 text-sm font-medium text-teal-ink">
            Open @{link.bot} in Telegram <IconExternal className="size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <p className="text-xs text-faint">Then press <b>Start</b>. The link works once and expires in 15 minutes.</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-warn">{error}</p>}
      <p className="text-xs text-faint">Covex only sends alerts for coins you watch. It will never ask for your seed phrase or private key.</p>
    </div>
  );
}
