import Link from "next/link";
import { Agent } from "@/components/agent/Agent";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconArrowRight, IconBell, IconLifebuoy, IconSearch } from "@/components/ui/icons";
import { SearchBar } from "@/components/ui/SearchBar";

const STAGES = [
  {
    Icon: IconSearch,
    title: "Before you buy",
    body: "A plain-English risk report from live CoinMarketCap data, plus what the founders promised and by when.",
    cta: "Check a coin",
    href: "#search",
    tone: "text-teal",
  },
  {
    Icon: IconBell,
    title: "While you hold",
    body: "Bag re-checks your coins and warns you on Telegram when promises slip or warning signs appear.",
    cta: "Open watchlist",
    href: "/watchlist",
    tone: "text-warn",
  },
  {
    Icon: IconLifebuoy,
    title: "If it went wrong",
    body: "Can you still sell? Protect what's left, gather evidence, and avoid recovery scammers.",
    cta: "Open rescue plan",
    href: "/rescue",
    tone: "text-rescue",
  },
];

export default function Home() {
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]" aria-labelledby="hero-title">
        <div className="order-2 space-y-8 lg:order-1">
          <div className="space-y-4">
            <h1 id="hero-title" className="text-[40px] leading-[44px] font-semibold tracking-tight text-balance sm:text-[56px] sm:leading-[60px]">
              Did the founders keep their promises, and can you still get out?
            </h1>
            <p className="max-w-xl text-lg text-muted">
              Bagcheck reads live CoinMarketCap data and the project&apos;s own roadmap, then explains the warning signs in plain
              English. Information, never financial advice.
            </p>
          </div>
          <div id="search" className="max-w-xl scroll-mt-24">
            <SearchBar autoFocus={false} />
          </div>
        </div>
        <div className="order-1 flex justify-center lg:order-2">
          <Agent state="idle" size={360} />
        </div>
      </section>

      <section aria-labelledby="stages-title" className="space-y-6">
        <h2 id="stages-title" className="text-2xl font-semibold tracking-tight">Bag helps at every stage</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {STAGES.map((s) => (
            <GlassCard as="li" key={s.title} interactive className="flex flex-col gap-3">
              <s.Icon className={`size-7 ${s.tone}`} />
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
              <Link href={s.href} className="mt-auto inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-teal hover:underline">
                {s.cta} <IconArrowRight className="size-4" />
              </Link>
            </GlassCard>
          ))}
        </ul>
      </section>
    </div>
  );
}
