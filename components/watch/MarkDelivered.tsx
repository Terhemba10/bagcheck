"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconCheck } from "@/components/ui/icons";

/** Your own note that a promise was delivered: Bag stops reminding you about it. */
export function MarkDelivered({ coinId, quote }: { coinId: number; quote: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function mark() {
    setBusy(true);
    const quoteKey = await sha16(quote);
    const res = await fetch("/api/promises/delivered", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coinId, quoteKey, delivered: true }) }).catch(() => null);
    setDone(Boolean(res?.ok));
    setBusy(false);
  }

  if (done) {
    return (
      <p className="flex items-center gap-2 text-sm text-ok">
        <IconCheck className="size-4" /> Marked as delivered. Bag won&apos;t remind you about this promise again.
      </p>
    );
  }
  return (
    <Button variant="secondary" onClick={mark} disabled={busy}>
      {busy ? "Saving…" : "It was delivered"}
    </Button>
  );
}

/** Same key as the server's quoteKey(): sha256 of the normalised quote, first 16 hex chars. */
async function sha16(quote: string): Promise<string> {
  const norm = quote.toLowerCase().replace(/\s+/g, " ").trim();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
