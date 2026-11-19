import type { Metadata } from "next";
import { AgentPlayground, AgentStateStrip } from "@/components/agent/AgentPlayground";
import { LoadingDemo, StateDemos } from "@/components/design/StateDemos";
import { Button, ButtonLink } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconArrowRight, IconBell, IconLifebuoy } from "@/components/ui/icons";
import { Disclaimer, Notice } from "@/components/ui/Notice";
import { PromiseItem } from "@/components/ui/PromiseItem";
import { SearchBar } from "@/components/ui/SearchBar";
import { SignalCard } from "@/components/ui/SignalCard";
import { SourceTag } from "@/components/ui/SourceTag";
import { Sparkline } from "@/components/ui/Sparkline";
import { ScoreBadge, StatusPill } from "@/components/ui/StatusPill";
import type { Level } from "@/components/ui/status";

export const metadata: Metadata = { title: "Design system" };

const COLORS = [
  ["bg", "#070B18", "Page"],
  ["bg-raised", "#0C1328", "Panels"],
  ["text", "#E9EEF9", "Body · 16.9:1"],
  ["muted", "#A3B0CC", "Secondary · 9.0:1"],
  ["faint", "#7C89A6", "Captions · 5.6:1"],
  ["teal", "#3EE6C8", "Brand · 12.5:1"],
  ["ok", "#4ADE80", "Low concern · 11.3:1"],
  ["warn", "#FBBF24", "Medium · 11.8:1"],
  ["danger", "#FF8094", "High · 8.2:1"],
  ["rescue", "#7AB2FF", "Rescue · 9.0:1"],
  ["info", "#B49CFF", "Recorded demo · 8.5:1"],
] as const;

const LEVEL_LIST: Level[] = ["ok", "watch", "concern", "danger", "unknown", "rescue"];

// Illustrative values for the style guide only (clearly labelled on the page).
const DEMO_RECORDED_AT = "2026-11-19T15:50:00Z";

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-5 border-t border-line pt-10">
      <div className="space-y-1">
        <h2 id={id} className="text-2xl font-semibold tracking-tight">{title}</h2>
        {intro && <p className="max-w-2xl text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <p className="text-xs font-medium tracking-wide text-teal uppercase">Living style guide</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Bagcheck design system</h1>
        <p className="max-w-2xl text-lg text-muted">
          Tokens, components and Bag, the agent, rendered from the real code. The spec lives in{" "}
          <code className="rounded bg-glass-strong px-1.5 py-0.5 font-mono text-sm">design/DESIGN_SPEC.md</code>. Example numbers
          on this page are made up to show the components.
        </p>
      </header>

      <Section id="agent" title="Bag, the agent" intro="One calm assistant across the app. Pick a state. The hero uses 3D on capable devices; the 2D orb is the fallback and the corner agent.">
        <AgentPlayground />
        <AgentStateStrip />
      </Section>

      <Section id="color" title="Colour" intro="Dark navy with glass surfaces. Contrast ratios are computed against the page background (WCAG 2.x).">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map(([name, hex, use]) => (
            <li key={name} className="glass overflow-hidden rounded-lg">
              <div className="h-16 border-b border-line" style={{ background: hex }} />
              <div className="space-y-0.5 p-3 text-sm">
                <p className="font-medium">--{name}</p>
                <p className="font-mono text-xs text-muted">{hex}</p>
                <p className="text-xs text-faint">{use}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title="Typography" intro="Inter, with tabular numbers for anything that changes.">
        <GlassCard className="space-y-4">
          <p className="text-4xl font-semibold tracking-tight sm:text-[56px] sm:leading-[60px]">Can you still get out?</p>
          <p className="text-[40px] leading-[46px] font-semibold">Heading 1 · 40</p>
          <p className="text-[28px] leading-[34px] font-semibold">Heading 2 · 28</p>
          <p className="text-xl font-semibold">Heading 3 · 20</p>
          <p className="max-w-prose">
            Body 16. Only 18% of all tokens exist today. The other 82% can still be released, which often pushes the price down.
          </p>
          <p className="text-sm text-muted">Small 14: secondary information and captions.</p>
          <p className="text-xs font-medium tracking-wide text-faint uppercase">Micro label · 12</p>
          <p className="tabular text-[32px] leading-9 font-semibold">$1,264,898,653,543</p>
        </GlassCard>
      </Section>

      <Section id="status" title="Status" intro="Always icon + label + colour, never colour alone.">
        <div className="flex flex-wrap gap-3">
          {LEVEL_LIST.map((l) => (
            <StatusPill key={l} level={l} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard><ScoreBadge concern="low" scored={7} total={7} /></GlassCard>
          <GlassCard><ScoreBadge concern="medium" scored={5} total={7} /></GlassCard>
          <GlassCard><ScoreBadge concern="high" scored={6} total={7} /></GlassCard>
        </div>
      </Section>

      <Section id="sources" title="Data source tags" intro="Every data block says where its numbers came from.">
        <GlassCard className="flex flex-wrap gap-x-8 gap-y-3">
          <SourceTag kind="live" />
          <SourceTag kind="cached" when="4 min ago" />
          <SourceTag kind="saved" when="3 h ago" />
          <SourceTag kind="recorded" at={DEMO_RECORDED_AT} />
          <SourceTag kind="paid-plan" />
        </GlassCard>
      </Section>

      <Section id="buttons" title="Buttons and search">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary"><IconBell className="size-4" /> Watch this coin</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger-ghost"><IconLifebuoy className="size-4" /> Open rescue plan</Button>
          <ButtonLink href="/" variant="secondary" size="lg">Large link <IconArrowRight className="size-4" /></ButtonLink>
          <Button disabled>Disabled</Button>
        </div>
        <div className="max-w-2xl">
          <SearchBar />
        </div>
      </Section>

      <Section id="signals" title="Signal cards" intro="Value, one-sentence meaning, why it matters, and the source.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SignalCard
            title="Dilution"
            level="concern"
            value="18%"
            valueLabel="of all tokens exist today"
            meaning="Only 18% of all tokens exist today. The other 82% can still be released, which often pushes the price down."
            why="New tokens entering the market add selling pressure, especially around scheduled unlocks."
            source={{ kind: "live" }}
          />
          <SignalCard
            title="Volume sanity"
            level="ok"
            value="0.04"
            valueLabel="24h volume ÷ market cap"
            meaning="About 4% of the coin's value traded in the last day, which is a normal range."
            why="Very high ratios can mean wash trading; very low ones mean it may be hard to sell."
            source={{ kind: "cached", when: "2 min ago" }}
          />
          <SignalCard
            title="Exchange concentration"
            level="unknown"
            meaning="We can't see exchange-by-exchange volume on the current CMC plan."
            why="When most trading sits on one exchange, a single delisting can trap holders."
            source={{ kind: "paid-plan" }}
          />
        </div>
      </Section>

      <Section id="notices" title="Notices and disclaimer">
        <div className="grid gap-3">
          <Notice tone="rescue" title="Recovery-scam shield" role="note">
            Anyone who guarantees to recover lost crypto for an upfront fee is running a scam. Real authorities never charge recovery fees.
          </Notice>
          <Notice tone="warn" title="Monitoring paused to save API credits">Reports still work. Watchlist checks resume when credits reset.</Notice>
          <Notice tone="info" title="Recorded data">Recorded from the live CMC API on 19 Nov 2026. This data needs a paid plan, so it isn&apos;t live right now.</Notice>
          <Notice tone="danger" title="Never share your seed phrase">Bagcheck will never ask for it. If you pasted one anywhere, move your funds to a new wallet.</Notice>
          <Disclaimer />
        </div>
      </Section>

      <Section id="timeline" title="Promise timeline" intro="What the founders promised and by when. Quotes stay under 15 words and link to the source.">
        <GlassCard>
          <ol>
            <PromiseItem status="delivered" dueDate="2025-Q2" promise="Mainnet launch" quote="Mainnet goes live in Q2 2025 with staking enabled." sourceUrl="https://example.org/roadmap" />
            <PromiseItem status="overdue" dueDate="2026-09" promise="Listing on two major exchanges" quote="We are targeting two tier-one exchange listings by September." sourceUrl="https://example.org/roadmap" />
            <PromiseItem status="due-soon" dueDate="2026-12-15" promise="Public security audit" quote="A full third-party audit will be published in December." sourceUrl="https://example.org/docs" />
            <PromiseItem status="no-date" dueDate={null} promise="Mobile wallet app" quote="A mobile wallet is coming soon." sourceUrl="https://example.org" />
          </ol>
        </GlassCard>
      </Section>

      <Section id="charts" title="Sparklines">
        <GlassCard className="flex flex-wrap items-center gap-8">
          <Sparkline values={[72, 70, 71, 66, 60, 58, 49, 41]} level="danger" label="Health score falling from 72 to 41 over 8 checks" />
          <Sparkline values={[40, 44, 43, 50, 55, 54, 60]} level="ok" label="Health score rising from 40 to 60 over 7 checks" />
          <Sparkline values={[50, 52, 49, 51, 50, 53]} level="watch" label="Health score steady around 50" />
          <Sparkline values={[1]} label="Not enough checks yet" />
        </GlassCard>
      </Section>

      <Section id="states" title="States" intro="Every screen has these: loading, empty, error, rate-limited and plan-blocked.">
        <LoadingDemo />
        <StateDemos />
      </Section>
    </div>
  );
}
