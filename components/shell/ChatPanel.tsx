"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { CovexMark } from "@/components/brand/CovexMark";
import { IconX } from "@/components/ui/icons";
import { DISCLAIMER } from "@/components/ui/Notice";
import { agent, useAgent } from "@/lib/client/agentStore";
import { ui } from "@/lib/client/uiStore";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";
import { detectSecret } from "@/lib/safety/secrets";

interface Msg {
  role: "user" | "covex";
  text: string;
  source?: "ai" | "report";
  warn?: boolean;
}

const SUGGESTIONS = ["Why this score?", "Can I still sell easily?", "Are big unlocks coming?", "What did they promise?"];

/**
 * "Ask Covex": a side sheet (bottom sheet on phones). On a coin report it answers
 * questions about that coin using only the report's data (the server rejects
 * advice and numbers that aren't in the facts). Seed phrases never leave the browser.
 */
export function ChatPanel() {
  const { chatOpen } = useAgent();
  return <AnimatePresence>{chatOpen && <Sheet />}</AnimatePresence>;
}

function Sheet() {
  const { coin, working, tone } = useAgent();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCoin, setLastCoin] = useState<number | null>(coin?.coinId ?? null);
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // new coin on screen: start a fresh conversation (adjusting state during render)
  if ((coin?.coinId ?? null) !== lastCoin) {
    setLastCoin(coin?.coinId ?? null);
    setMsgs([]);
  }

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    (inputRef.current ?? document.getElementById(`${panelId}-close`))?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && agent.closeChat();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [panelId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || !coin || busy) return;
    const secret = detectSecret(q);
    if (secret) {
      setInput("");
      setMsgs((m) => [...m, { role: "covex", text: secret.message, warn: true }]);
      return;
    }
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coinId: coin.coinId, question: q }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMsgs((m) => [...m, { role: "covex", text: body?.error?.message ?? "I couldn't answer that right now. Please try again in a moment.", warn: res.status === 400 }]);
      } else {
        setMsgs((m) => [...m, { role: "covex", text: body.answer, source: body.source }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "covex", text: "I couldn't reach the server. Please check your connection and try again." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const title = coin ? `Ask Covex about ${coin.name}` : "Ask Covex";

  return (
    <motion.section
      id={panelId}
      role="dialog"
      aria-label={title}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col rounded-t-2xl border border-line-strong bg-surface-1 shadow-[var(--shadow-pop)] md:inset-x-auto md:top-3 md:right-3 md:bottom-3 md:max-h-none md:w-[24rem] md:rounded-2xl print:hidden"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: duration.base, ease: ease.out }}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <CovexMark size={28} tone={tone} working={working || busy} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-faint">{coin ? "Answers come only from this report's data" : "Open a coin's report to ask about it"}</p>
        </div>
        <button id={`${panelId}-close`} type="button" onClick={agent.closeChat} className="grid size-10 place-items-center rounded-md text-muted hover:bg-glass hover:text-text" aria-label="Close Ask Covex">
          <IconX className="size-4" />
        </button>
      </header>

      {!coin ? (
        <div className="space-y-3 p-4 text-sm">
          <p className="text-muted">Open any coin&apos;s report and I can answer questions about it: the score, the warning signs, liquidity and what the team promised.</p>
          <button
            type="button"
            onClick={() => {
              agent.closeChat();
              ui.openPalette();
            }}
            className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-teal hover:bg-teal-soft"
          >
            Check a coin →
          </button>
          <p className="text-xs text-faint">
            Or try <Link className="text-teal hover:underline" href="/coin/24478" onClick={agent.closeChat}>Pepe</Link>.
          </p>
        </div>
      ) : (
        <>
          <div ref={listRef} className="min-h-40 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {msgs.length === 0 && (
              <div className="space-y-3 text-sm">
                <p className="text-muted">{coin.verdict}</p>
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
              <div
                key={i}
                className={cn(
                  "max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user" ? "ml-auto bg-teal-soft text-text" : m.warn ? "border border-danger/40 bg-danger-soft" : "border border-line bg-surface-2",
                )}
              >
                {m.role === "covex" && <span className="sr-only">Covex: </span>}
                {m.text}
                {m.source && <span className="mt-1 block text-[11px] text-faint">{m.source === "ai" ? "AI explanation of the report's numbers" : "From the report data"}</span>}
              </div>
            ))}
            {busy && <p className="shimmer-text text-xs">Covex is reading the report…</p>}
          </div>
          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <label htmlFor={`${panelId}-q`} className="sr-only">Your question about {coin.name}</label>
            <input
              ref={inputRef}
              id={`${panelId}-q`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={400}
              autoComplete="off"
              placeholder="Ask about this coin…"
              className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-black px-3 text-sm outline-none placeholder:text-faint focus:border-teal"
            />
            <button type="submit" disabled={busy || input.trim().length < 2} className="min-h-10 rounded-md bg-teal px-3 text-sm font-medium text-teal-ink disabled:opacity-50">
              Ask
            </button>
          </form>
          <p className="px-3 pb-3 text-[11px] text-faint">{DISCLAIMER} Never share your seed phrase.</p>
        </>
      )}
    </motion.section>
  );
}
