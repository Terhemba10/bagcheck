"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconBell, IconCheck } from "@/components/ui/icons";

type State = "unknown" | "idle" | "busy" | "watching" | "error";

/** "Watch this coin": adds it to this browser's watchlist (no account needed). */
export function WatchButton({ coinId, name }: { coinId: number; name: string }) {
  const [state, setState] = useState<State>("unknown");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/watchlist", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { coins?: { id: number }[] } | null) => setState(j?.coins?.some((c) => c.id === coinId) ? "watching" : "idle"))
      .catch((e: Error) => e.name !== "AbortError" && setState("idle"));
    return () => ctrl.abort();
  }, [coinId]);

  async function watch() {
    setState("busy");
    setMessage(null);
    const res = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coinId }) }).catch(() => null);
    if (res?.ok) return setState("watching");
    const body = await res?.json().catch(() => null);
    setMessage(body?.error?.message ?? "Couldn't add it right now. Please try again.");
    setState("error");
  }

  if (state === "watching") {
    return (
      <div className="space-y-2">
        <Link href="/watchlist" className="glass flex min-h-12 w-full items-center justify-center gap-2 rounded-md text-base font-medium text-ok hover:bg-glass-strong">
          <IconCheck className="size-5" /> Watching {name}
        </Link>
        <p className="text-center text-xs text-faint">Bag re-checks it on a schedule. Get alerts on Telegram from your watchlist.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Button variant="secondary" size="lg" className="w-full" onClick={watch} disabled={state === "busy" || state === "unknown"}>
        <IconBell className="size-5" /> {state === "busy" ? "Adding…" : "Watch this coin"}
      </Button>
      <p role={message ? "alert" : undefined} className="text-center text-xs text-faint">
        {message ?? "No account needed. Bag will re-check it and can alert you on Telegram."}
      </p>
    </div>
  );
}
