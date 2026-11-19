"use client";

import { useId, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconInfo } from "@/components/ui/icons";
import { Notice } from "@/components/ui/Notice";
import { money } from "@/lib/core/format";
import { estimateImpact, impactForPool, isThin } from "@/lib/rescue/impact";
import type { Rescue } from "@/lib/rescue/build";

const pctText = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;

/**
 * "Can I still sell?": information only. Where the liquidity is, and an
 * ESTIMATE of price impact for the user's amount. Never "sell"/"hold".
 */
export function SellSection({ r }: { r: Rescue }) {
  const id = useId();
  const [amount, setAmount] = useState("1000");
  const usd = Number(amount.replace(/[,\s$]/g, ""));
  const valid = Number.isFinite(usd) && usd > 0;
  const est = valid ? estimateImpact(usd, r.sell.pools) : null;
  const pools = r.sell.pools;
  const thin = pools.length > 0 && isThin(r.sell.totalTokenSideUsd);

  return (
    <section id="sell" aria-labelledby="sell-title" className="scroll-mt-24 space-y-4">
      <h2 id="sell-title" className="text-2xl font-semibold tracking-tight">1. Can I still sell?</h2>
      <p className="text-muted">Where {r.coin.name} can be traded right now, and how much a sale of your size might move the price. This is information to help you decide; it isn&apos;t a recommendation.</p>

      {r.sell.numMarkets !== null && (
        <p className="text-sm">
          CoinMarketCap currently tracks <b className="tabular">{r.sell.numMarkets.toLocaleString("en-US")}</b> market{r.sell.numMarkets === 1 ? "" : "s"} for {r.coin.symbol}.
        </p>
      )}

      {thin && (
        <Notice tone="warn" title="Liquidity is thin">
          A $1,000 sale would move the price by about {pctText(impactForPool(1000, r.sell.totalTokenSideUsd) ?? 0)} across all DEX pools (estimate).
        </Notice>
      )}

      {/* DEX pools */}
      {pools.length > 0 ? (
        <GlassCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="px-5 pt-4 text-left text-base font-semibold">Decentralised exchange pools (live)</caption>
            <thead className="text-xs text-faint">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Exchange</th>
                <th scope="col" className="px-5 py-3 font-medium">Pair</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">{r.coin.symbol} in pool</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">24h volume</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-5 py-3">{p.dex}</td>
                  <td className="px-5 py-3 text-muted">{p.pair}</td>
                  <td className="tabular px-5 py-3 text-right">{money(p.tokenSideUsd)}</td>
                  <td className="tabular px-5 py-3 text-right text-muted">{money(p.volume24h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      ) : (
        <GlassCard>
          <p className="text-sm">
            {r.coin.contract
              ? "We found no DEX pools with meaningful liquidity for this token."
              : `${r.coin.name} isn't a token in DEX pools; it trades on exchanges.`}
          </p>
        </GlassCard>
      )}

      {/* centralised exchanges */}
      <GlassCard className="space-y-2">
        <h3 className="text-base font-semibold">Centralised exchanges</h3>
        {r.sell.cex.status === "ok" ? (
          <ul className="space-y-1 text-sm">
            {r.sell.cex.markets.map((m, i) => (
              <li key={i} className="tabular flex flex-wrap justify-between gap-2 border-t border-line pt-1 first:border-t-0">
                <span>
                  {m.exchange} <span className="text-muted">{m.pair}</span>
                </span>
                <span className="text-muted">
                  {m.depthMinus2 !== null ? `${money(m.depthMinus2)} to move −2%` : "no depth data"} · {pctText(m.volumeShare)} of volume
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            {r.sell.cex.status === "plan"
              ? "Exchange-by-exchange depth needs a paid CoinMarketCap plan, so it isn't shown live. If you hold this coin on an exchange, its order book shows how much can be sold near the current price."
              : "Exchange data isn't available right now."}
          </p>
        )}
      </GlassCard>

      {/* estimate calculator */}
      {pools.length > 0 && (
        <GlassCard className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={`${id}-amt`} className="block text-sm font-medium">
                Amount you hold, in US dollars at today&apos;s price
              </label>
              <div className="mt-1 flex items-center rounded-md border border-line bg-bg px-3 focus-within:border-teal">
                <span className="text-muted">$</span>
                <input
                  id={`${id}-amt`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="tabular min-h-11 w-40 bg-transparent px-2 outline-none"
                  aria-describedby={`${id}-note`}
                />
              </div>
            </div>
            <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold tracking-wide text-warn uppercase">Estimate</span>
          </div>

          {est && est.deepestPool && est.acrossPools ? (
            <dl className="grid gap-3 sm:grid-cols-3" aria-live="polite">
              <div className="rounded-lg bg-glass-strong p-3">
                <dt className="text-xs text-faint">All in the deepest pool ({est.deepestPool.dex})</dt>
                <dd className="tabular text-2xl font-semibold">~{pctText(est.deepestPool.impact)}</dd>
                <dd className="text-xs text-muted">≈ {money(usd * est.deepestPool.impact)} less than today&apos;s price</dd>
              </div>
              <div className="rounded-lg bg-glass-strong p-3">
                <dt className="text-xs text-faint">Spread across all {est.acrossPools.pools} pools</dt>
                <dd className="tabular text-2xl font-semibold">~{pctText(est.acrossPools.impact)}</dd>
                <dd className="text-xs text-muted">what a DEX aggregator roughly does</dd>
              </div>
              {est.inParts && (
                <div className="rounded-lg bg-glass-strong p-3">
                  <dt className="text-xs text-faint">Each of {est.inParts.parts} smaller parts</dt>
                  <dd className="tabular text-2xl font-semibold">~{pctText(est.inParts.impactPerPart)}</dd>
                  <dd className="text-xs text-muted">per part, if the pools refill in between</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted">Enter an amount to see the estimate.</p>
          )}

          <p id={`${id}-note`} className="flex gap-2 text-xs text-faint">
            <IconInfo className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Estimate from a standard 50/50 pool model using live pool sizes. Concentrated-liquidity pools can be better or worse; fees, other traders and price
              moves aren&apos;t included. When liquidity is thin, selling in smaller parts over time usually moves the price less per sale, because pools are
              rebalanced by other trades in between; the price can also change while you wait.
            </span>
          </p>
        </GlassCard>
      )}
    </section>
  );
}
