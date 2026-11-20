import Link from "next/link";
import { CovexMark } from "@/components/brand/CovexMark";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { TiltCard } from "@/components/motion/TiltCard";
import { IconArrowRight, IconBell, IconLifebuoy, IconSearch } from "@/components/ui/icons";
import { SearchBar } from "@/components/ui/SearchBar";
import { WorthACheckRow } from "@/components/WorthACheckRow";
import { REPORT_STEPS } from "@/lib/core/steps";

const STAGES = [
  {
    Icon: IconSearch,
    step: "Before you buy",
    body: "A plain-English risk report from live CoinMarketCap data, plus what the founders promised and by when.",
    cta: "Check a coin",
    href: "#search",
    tone: "text-teal",
  },
  {
    Icon: IconBell,
    step: "While you hold",
    body: "Covex re-checks your coins and warns you on Telegram when promises slip or warning signs appear.",
    cta: "Open watchlist",
    href: "/watchlist",
    tone: "text-warn",
  },
  {
    Icon: IconLifebuoy,
    step: "If it went wrong",
    body: "Can you still sell? Protect what's left, gather evidence, and avoid recovery scammers.",
    cta: "Open rescue plan",
    href: "/rescue",
    tone: "text-rescue",
  },
];

export default function Home() {
  return (
    <div className="space-y-20 pb-8">
      <section aria-labelledby="hero-title" className="mx-auto flex max-w-3xl flex-col items-center pt-6 text-center sm:pt-14">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface-1 py-1 pr-3 pl-1.5 text-xs text-muted">
          <CovexMark size={18} />
          AI agent · live CoinMarketCap data
        </p>
        <h1 id="hero-title" className="text-[34px] leading-[40px] font-semibold tracking-tight text-balance sm:text-[52px] sm:leading-[58px]">
          Did the founders keep their promises, and can you still get out?
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
          Covex reads live market data and the project&apos;s own roadmap, then explains the warning signs in plain English. Information, never
          financial advice.
        </p>
        <div id="search" className="mt-10 w-full max-w-2xl scroll-mt-24 text-left">
          <SearchBar examples />
        </div>
        {/* what the agent will do: the same steps the activity panel shows */}
        <ol className="mt-8 flex max-w-2xl flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-faint" aria-label="What Covex checks">
          {REPORT_STEPS.map((s, i) => (
            <li key={s.id} className="inline-flex items-center gap-1.5">
              <span className="tabular grid size-4 place-items-center rounded-full border border-line text-[10px]">{i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
      </section>

      <WorthACheckRow />

      <section aria-labelledby="stages-title" className="space-y-6">
        <h2 id="stages-title" className="text-2xl font-semibold tracking-tight">Covex helps at every stage</h2>
        <Reveal as="ul" className="grid gap-4 md:grid-cols-3">
          {STAGES.map((s) => (
            <RevealItem as="li" key={s.step}>
              <TiltCard>
                <div className="glass flex h-full flex-col gap-3 rounded-lg p-5">
                  <s.Icon className={`size-6 ${s.tone}`} />
                  <h3 className="text-lg font-semibold">{s.step}</h3>
                  <p className="text-sm leading-relaxed text-muted">{s.body}</p>
                  <Link href={s.href} className="mt-auto inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-teal hover:underline">
                    {s.cta} <IconArrowRight className="size-4" />
                  </Link>
                </div>
              </TiltCard>
            </RevealItem>
          ))}
        </Reveal>
      </section>
    </div>
  );
}
