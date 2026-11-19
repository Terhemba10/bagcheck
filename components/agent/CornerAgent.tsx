"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useBagContext } from "@/lib/client/bagContext";
import { detectSecret } from "@/lib/safety/secrets";
import { DISCLAIMER } from "@/components/ui/Notice";
import { Agent2D } from "./Agent2D";
import { AGENT_LOOKS } from "./states";

interface Msg {
  role: "user" | "bag";
  text: string;
  source?: "ai" | "report";
  warn?: boolean;
}

const SUGGESTIONS = ["Why this score?", "Can I still sell easily?", "Are big unlocks coming?", "What did they promise?"];

/**
 * Bag in the corner of every page (2D, almost free to render). On a coin
 * report it takes the verdict's colour and answers questions about that coin,
 * using only the report's data.
 */
export function CornerAgent() {
  const ctx = useBagContext();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCoin, setLastCoin] = useState<number | null>(null);
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const state = ctx?.state ?? "idle";

  // new coin on screen: start a fresh conversation (adjusting state during render)
  if ((ctx?.coinId ?? null) !== lastCoin) {
    setLastCoin(ctx?.coinId ?? null);
    setMsgs([]);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || !ctx || busy) return;
    // never send secrets anywhere
    const secret = detectSecret(q);
    if (secret) {
      setInput("");
      setMsgs((m) => [...m, { role: "bag", text: secret.message, warn: true }]);
      return;
    }
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coinId: ctx.coinId, question: q }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMsgs((m) => [...m, { role: "bag", text: body?.error?.message ?? "I couldn't answer that right now. Please try again in a moment.", warn: res.status === 400 }]);
      } else {
        setMsgs((m) => [...m, { role: "bag", text: body.answer, source: body.source }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "bag", text: "I couldn't reach the server. Please check your connection and try again." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const label = ctx ? `Ask Bag about ${ctx.name}` : "What is Bag doing?";

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <section
          id={panelId}
          aria-label={label}
          className="flex max-h-[min(34rem,calc(100vh-7rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-line bg-bg-raised shadow-[0_24px_60px_-12px_rgb(0_0_0/.8)]"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Agent2D state={state} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{ctx ? `Ask Bag about ${ctx.name}` : "Hi, I'm Bag"}</p>
              <p className="truncate text-xs text-faint">{ctx ? "Answers come only from this report's data" : AGENT_LOOKS[state].caption}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-md text-muted hover:bg-glass hover:text-text" aria-label="Close">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>

          {!ctx ? (
            <div className="space-y-3 p-4 text-sm">
              <p>Open any coin&apos;s report and I can answer questions about it: the score, the warning signs, liquidity and what the team promised.</p>
              <Link href="/#search" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center text-teal hover:underline">
                Check a coin →
              </Link>
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                {msgs.length === 0 && (
                  <div className="space-y-3 text-sm">
                    <p className="text-muted">{ctx.verdict}</p>
                    <p className="text-xs text-faint">Try one of these:</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button key={s} type="button" onClick={() => ask(s)} className="min-h-9 rounded-full border border-line px-3 text-xs text-teal hover:bg-teal-soft">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={cn("max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed", m.role === "user" ? "ml-auto bg-teal-soft text-text" : m.warn ? "border border-danger/40 bg-danger-soft" : "bg-glass-strong")}>
                    {m.role === "bag" && <span className="sr-only">Bag: </span>}
                    {m.text}
                    {m.source && <span className="mt-1 block text-[11px] text-faint">{m.source === "ai" ? "AI explanation of the report's numbers" : "From the report data"}</span>}
                  </div>
                ))}
                {busy && <p className="text-xs text-muted">Bag is thinking…</p>}
              </div>
              <form
                className="flex gap-2 border-t border-line p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(input);
                }}
              >
                <label htmlFor={`${panelId}-q`} className="sr-only">Your question about {ctx.name}</label>
                <input
                  ref={inputRef}
                  id={`${panelId}-q`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={400}
                  autoComplete="off"
                  placeholder="Ask about this coin…"
                  className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-bg px-3 text-sm outline-none placeholder:text-faint focus:border-teal"
                />
                <button type="submit" disabled={busy || input.trim().length < 2} className="min-h-10 rounded-md bg-teal px-3 text-sm font-medium text-teal-ink disabled:opacity-50">
                  Ask
                </button>
              </form>
              <p className="px-3 pb-2 text-[11px] text-faint">{DISCLAIMER} Never share your seed phrase.</p>
            </>
          )}
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close Bag" : label}
        title={label}
        className="glass grid size-14 place-items-center rounded-full transition-transform duration-200 hover:scale-105"
      >
        <Agent2D state={state} size={44} />
      </button>
    </div>
  );
}
