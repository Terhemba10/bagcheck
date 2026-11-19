import { GlassCard } from "@/components/ui/GlassCard";
import { IconExternal } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/StatusPill";
import type { Report } from "@/lib/core/report";
import type { LinkCheck } from "@/lib/core/links";
import { money } from "@/lib/core/format";

/** Contract scan details (only for tokens with a scan). */
export function ContractDetails({ r }: { r: Report }) {
  const s = r.signals.find((x) => x.id === "contract");
  const d = s?.details as { buyTax?: number; sellTax?: number; items?: { code?: string; level?: string; des?: string }[] } | undefined;
  if (!s || !s.scored || !d) return null;
  return (
    <section aria-labelledby="contract-title" className="space-y-3">
      <h2 id="contract-title" className="text-xl font-semibold">Contract scan</h2>
      <GlassCard className="space-y-4">
        <dl className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-faint">Buy tax</dt>
            <dd className="tabular text-lg font-medium">{(d.buyTax ?? 0).toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Sell tax</dt>
            <dd className="tabular text-lg font-medium">{(d.sellTax ?? 0).toFixed(1)}%</dd>
          </div>
          {r.coin.contract && (
            <div className="min-w-0">
              <dt className="text-xs text-faint">Contract ({r.coin.platform ?? "token"})</dt>
              <dd className="font-mono text-xs break-all">{r.coin.contract}</dd>
            </div>
          )}
        </dl>
        {d.items && d.items.length > 0 ? (
          <ul className="space-y-2">
            {d.items.map((i, n) => (
              <li key={n} className="flex flex-col gap-1 border-t border-line pt-2 sm:flex-row sm:items-start sm:gap-3">
                <StatusPill level={i.level === "r" ? "danger" : "concern"} label={i.level === "r" ? "High risk" : "Worth knowing"} size="sm" />
                <div className="text-sm">
                  <p className="font-medium">{i.code}</p>
                  {i.des && <p className="text-muted">{i.des}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No risky switches were found in the scan.</p>
        )}
        <p className="text-xs text-faint">From CoinMarketCap&apos;s DEX security scan. A flag means the contract <em>can</em> do this, not that it has.</p>
      </GlassCard>
    </section>
  );
}

/** Where the DEX liquidity sits. */
export function PoolsTable({ r }: { r: Report }) {
  const s = r.signals.find((x) => x.id === "liquidity");
  const pools = (s?.details as { pools?: { dex: string; pair: string; liq: number; vol: number }[] } | undefined)?.pools;
  if (!pools?.length) return null;
  return (
    <section aria-labelledby="pools-title" className="space-y-3">
      <h2 id="pools-title" className="text-xl font-semibold">Where the liquidity is</h2>
      <GlassCard className="overflow-x-auto p-0">
        <table className="w-full min-w-[480px] text-left text-sm">
          <caption className="sr-only">DEX pools for {r.coin.name}, largest first</caption>
          <thead className="text-xs text-faint">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Exchange</th>
              <th scope="col" className="px-5 py-3 font-medium">Pair</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Liquidity</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">24h volume</th>
            </tr>
          </thead>
          <tbody>
            {pools.map((p, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-5 py-3">{p.dex}</td>
                <td className="px-5 py-3 text-muted">{p.pair}</td>
                <td className="tabular px-5 py-3 text-right">{money(p.liq)}</td>
                <td className="tabular px-5 py-3 text-right text-muted">{money(p.vol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
      <p className="text-xs text-faint">Exchange (CEX) order books need a paid CoinMarketCap plan and aren&apos;t included.</p>
    </section>
  );
}

const STATE_LABEL: Record<LinkCheck["state"], { label: string; level: "ok" | "danger" | "unknown" | "watch" }> = {
  up: { label: "Online", level: "ok" },
  blocked: { label: "Online (blocks bots)", level: "ok" },
  down: { label: "Not responding", level: "danger" },
  skipped: { label: "Not checked", level: "unknown" },
};

export function LinksList({ r }: { r: Report }) {
  if (!r.links.length) return null;
  return (
    <section aria-labelledby="links-title" className="space-y-3">
      <h2 id="links-title" className="text-xl font-semibold">Official links</h2>
      <GlassCard className="p-0">
        <ul>
          {r.links.map((l, i) => {
            const st = STATE_LABEL[l.state];
            return (
              <li key={i} className="flex flex-col gap-2 border-t border-line px-5 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
                <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-w-0 items-center gap-1.5 text-sm hover:text-teal">
                  <span className="text-xs text-faint capitalize">{l.kind}</span>
                  <span className="truncate">{l.url.replace(/^https?:\/\//, "")}</span>
                  <IconExternal className="size-3.5 shrink-0" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                <span className="flex items-center gap-2">
                  <StatusPill level={st.level} label={st.label} size="sm" />
                  {l.reason && l.state !== "up" && <span className="text-xs text-faint">{l.reason}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </section>
  );
}
