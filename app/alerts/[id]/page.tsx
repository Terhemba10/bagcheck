import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkDelivered } from "@/components/watch/MarkDelivered";
import { BeforeAfterChart } from "@/components/watch/BeforeAfterChart";
import { CovexMark } from "@/components/brand/CovexMark";
import { GlassCard } from "@/components/ui/GlassCard";
import { Disclaimer } from "@/components/ui/Notice";
import { StatusPill } from "@/components/ui/StatusPill";
import { getAlert, getSnapshots, type Snapshot } from "@/lib/monitor/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alert" };

export default async function AlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{3,80}$/.test(id)) notFound();
  const a = await getAlert(id);
  if (!a) notFound();
  const snaps = a.metric ? (await getSnapshots(a.coinId, 30)).reverse() : [];
  const series = a.metric
    ? snaps
        .filter((s) => typeof s[a.metric!] === "number" && Date.parse(s.at) <= Date.parse(a.at))
        .map((s) => ({ at: s.at, value: s[a.metric as keyof Snapshot] as number }))
    : [];
  const quote = a.rule === "promise_overdue" ? a.quote : undefined;

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-line bg-surface-1"><CovexMark size={40} tone={a.severity === "danger" ? "high" : "medium"} /></span>
        <div className="space-y-2">
          <StatusPill level={a.severity} />
          <h1 className="text-3xl font-semibold tracking-tight">{a.title}</h1>
          <p className="text-muted">
            <Link href={`/coin/${a.coinId}`} className="text-teal hover:underline">
              {a.coinName} ({a.coinSymbol})
            </Link>{" "}
            · {new Date(a.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
          </p>
        </div>
      </header>

      <GlassCard className="space-y-4">
        <h2 className="text-lg font-semibold">What changed</h2>
        <p className="tabular flex flex-wrap items-center gap-3 text-2xl font-semibold">
          <span className="text-muted">{a.before}</span>
          <span aria-hidden="true">→</span>
          <span className="sr-only">changed to</span>
          <span>{a.after}</span>
        </p>
        {series.length >= 2 && <BeforeAfterChart series={series} label={a.title} severity={a.severity} />}
      </GlassCard>

      <GlassCard className="space-y-2">
        <h2 className="text-lg font-semibold">What it means</h2>
        <p className="leading-relaxed">{a.meaning}</p>
      </GlassCard>

      <GlassCard className="space-y-3">
        <h2 className="text-lg font-semibold">What to check next</h2>
        <ul className="list-disc space-y-1 pl-5">
          {a.next.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        {quote && <MarkDelivered coinId={a.coinId} quote={quote} />}
        <div className="flex flex-wrap gap-4 pt-2 text-sm">
          <Link href={`/coin/${a.coinId}`} className="text-teal hover:underline">Open today&apos;s report →</Link>
          <Link href={`/rescue/${a.coinId}`} className="text-rescue hover:underline">Rescue plan for {a.coinSymbol}</Link>
          <Link href="/watchlist" className="text-teal hover:underline">Back to your watchlist</Link>
        </div>
      </GlassCard>
      <Disclaimer />
    </article>
  );
}
