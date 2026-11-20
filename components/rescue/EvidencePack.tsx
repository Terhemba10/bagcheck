"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconLock } from "@/components/ui/icons";
import { buildEvidenceText, EMPTY_EVIDENCE, EVIDENCE_LABELS, findSecrets, type EvidenceFields } from "@/lib/rescue/evidence";
import { SECRET_WARNING_SAVED } from "@/lib/safety/secrets";

/**
 * Evidence summary, built and downloaded entirely in the browser. Nothing is
 * sent to Covex or saved. Any field containing a seed phrase or private key
 * is cleared immediately and the download is blocked.
 */
export function EvidencePack({ coin, facts }: { coin: { id: number; name: string; symbol: string } | null; facts: string[] }) {
  const id = useId();
  const [f, setF] = useState<EvidenceFields>(EMPTY_EVIDENCE);
  const [blocked, setBlocked] = useState<(keyof EvidenceFields)[]>([]);
  const [done, setDone] = useState(false);

  function update(k: keyof EvidenceFields, v: string) {
    const next = { ...f, [k]: v };
    const hits = findSecrets(next);
    if (hits.includes(k)) {
      // never keep a secret, not even in memory: clear the field
      next[k] = "";
      setBlocked((b) => [...new Set([...b, k])]);
    } else {
      setBlocked((b) => b.filter((x) => x !== k));
    }
    setF(next);
    setDone(false);
  }

  function download() {
    if (findSecrets(f).length) return; // belt and braces: never build a file with a secret in it
    const text = buildEvidenceText(f, coin, new Date(), facts);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `covex-evidence-${coin?.symbol.toLowerCase() ?? "summary"}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setDone(true);
  }

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-start gap-3">
        <IconLock className="mt-1 size-5 shrink-0 text-rescue" />
        <div>
          <h3 className="text-lg font-semibold">Evidence summary</h3>
          <p className="text-sm text-muted">Built on your device and downloaded as a text file. Nothing you type here is sent to Covex or saved.</p>
        </div>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          download();
        }}
      >
        {(Object.keys(EVIDENCE_LABELS) as (keyof EvidenceFields)[]).map((k) => {
          const meta = EVIDENCE_LABELS[k];
          const fid = `${id}-${k}`;
          const isBlocked = blocked.includes(k);
          const common = {
            id: fid,
            value: f[k],
            onChange: (e: { target: { value: string } }) => update(k, e.target.value),
            "aria-describedby": `${fid}-hint${isBlocked ? ` ${fid}-err` : ""}`,
            "aria-invalid": isBlocked || undefined,
            autoComplete: "off",
            spellCheck: false,
            className: "w-full rounded-md border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-teal",
          };
          return (
            <div key={k} className="space-y-1">
              <label htmlFor={fid} className="block text-sm font-medium">{meta.label}</label>
              <p id={`${fid}-hint`} className="text-xs text-faint">{meta.hint}</p>
              {meta.multiline ? <textarea rows={k === "whatHappened" ? 4 : 2} {...common} /> : <input {...common} />}
              {isBlocked && (
                <p id={`${fid}-err`} role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-2 text-xs">
                  🔒 {SECRET_WARNING_SAVED} The field was cleared.
                </p>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Download evidence summary (.txt)</Button>
          {done && <span role="status" className="text-sm text-ok">Downloaded. Keep it with your screenshots.</span>}
        </div>
      </form>
    </GlassCard>
  );
}
