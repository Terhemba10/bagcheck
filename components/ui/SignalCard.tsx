import { GlassCard } from "./GlassCard";
import { SourceTag, type SourceKind } from "./SourceTag";
import { StatusPill } from "./StatusPill";
import type { Level } from "./status";

export interface SignalCardProps {
  title: string;
  level: Level;
  /** The headline number, already formatted ("18%", "$2.1M"). Omit when unknown. */
  value?: string;
  /** Short label under the value ("of all tokens exist today"). */
  valueLabel?: string;
  /** One sentence: what the number means. */
  meaning: string;
  /** Why it matters to a holder. */
  why: string;
  source: { kind: SourceKind; at?: string; when?: string };
}

export function SignalCard({ title, level, value, valueLabel, meaning, why, source }: SignalCardProps) {
  return (
    <GlassCard as="article" level={level} className="flex h-full flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <StatusPill level={level} size="sm" />
      </header>
      {value ? (
        <p>
          <span className="tabular text-3xl font-semibold tracking-tight">{value}</span>
          {valueLabel && <span className="ml-2 text-sm text-muted">{valueLabel}</span>}
        </p>
      ) : (
        <p className="text-sm text-muted">No data for this coin.</p>
      )}
      <p className="text-sm leading-relaxed">{meaning}</p>
      <details className="group text-sm text-muted">
        <summary className="cursor-pointer select-none font-medium text-text/90 hover:text-text">Why it matters</summary>
        <p className="mt-2 leading-relaxed">{why}</p>
      </details>
      <footer className="mt-auto border-t border-line pt-3">
        <SourceTag {...source} />
      </footer>
    </GlassCard>
  );
}
