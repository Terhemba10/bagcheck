import type { Metadata } from "next";
import { CovexMark } from "@/components/brand/CovexMark";
import { EvidencePack } from "@/components/rescue/EvidencePack";
import { ProtectSection, ReportWhere, ScamShield } from "@/components/rescue/RescueSections";
import { Disclaimer } from "@/components/ui/Notice";
import { SearchBar } from "@/components/ui/SearchBar";

export const metadata: Metadata = { title: "Rescue plan" };

/** Rescue for anyone: pick any coin (watched or not), or use the general steps right away. */
export default function RescuePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-line bg-surface-1"><CovexMark size={40} tone="rescue" /></span>
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-rescue uppercase">Rescue plan</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Something went wrong? Let&apos;s take it one step at a time.</h1>
        </div>
      </header>

      <ScamShield />

      <section aria-labelledby="pick" className="space-y-3">
        <h2 id="pick" className="text-xl font-semibold">Which coin?</h2>
        <p className="text-sm text-muted">Pick any coin to see where it can still be traded, an estimate of price impact for your amount, and what Covex&apos;s history shows.</p>
        <SearchBar size="md" target="rescue" />
      </section>

      <ProtectSection chain={null} />

      <section aria-labelledby="ev" className="space-y-4">
        <h2 id="ev" className="text-2xl font-semibold tracking-tight">3. Evidence and reporting</h2>
        <EvidencePack coin={null} facts={[]} />
        <ReportWhere />
      </section>
      <Disclaimer />
    </div>
  );
}
