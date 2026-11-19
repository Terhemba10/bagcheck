import { GlassCard } from "@/components/ui/GlassCard";
import { IconExternal, IconShield, IconTriangle } from "@/components/ui/icons";
import { Notice } from "@/components/ui/Notice";
import { StatusPill } from "@/components/ui/StatusPill";
import { EXCHANGE_SUPPORT, IC3, REVOKE_GUIDE, revokeCheckerFor, SCAM_SHIELD, WALLET_HELP, type OfficialLink } from "@/lib/rescue/links";
import type { Lessons } from "@/lib/rescue/lessons";

/** Links from the hard-coded allowlist only (lib/rescue/links.ts). */
export function OfficialA({ link }: { link: OfficialLink }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal underline-offset-2 hover:underline">
      {link.label} <IconExternal className="size-3.5" />
      <span className="sr-only">(official site, opens in a new tab)</span>
    </a>
  );
}

export function ScamShield() {
  return (
    <section aria-labelledby="shield-title" className="rounded-xl border border-rescue/50 bg-rescue-soft p-5">
      <div className="flex gap-3">
        <IconShield className="mt-0.5 size-6 shrink-0 text-rescue" />
        <div className="space-y-2">
          <h2 id="shield-title" className="text-lg font-semibold">Recovery-scam shield</h2>
          <p className="text-base leading-relaxed">{SCAM_SHIELD}</p>
          <p className="text-sm text-text/80">
            After a loss, people are often contacted by &ldquo;recovery experts&rdquo; or fake officials. Don&apos;t pay them, and never share your seed phrase.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ProtectSection({ chain }: { chain: string | null }) {
  const checker = revokeCheckerFor(chain);
  return (
    <section id="protect" aria-labelledby="protect-title" className="scroll-mt-24 space-y-4">
      <h2 id="protect-title" className="text-2xl font-semibold tracking-tight">2. If your wallet was drained or you approved a bad site</h2>
      <p className="text-muted">Protect what&apos;s left. These steps stop further losses; they don&apos;t reverse what already happened.</p>
      {/* the warning sits directly above the revoke steps, by design */}
      <Notice tone="danger" title="Beware of fake “revoke” and “recovery” sites">
        Scammers copy approval checkers to steal more. Only use the official links below, typed or bookmarked, never links from messages, ads or the project&apos;s
        own channels.
      </Notice>
      <GlassCard>
        <ol className="list-decimal space-y-4 pl-5">
          <li>
            <p className="font-medium">Stop signing.</p>
            <p className="text-sm text-muted">Don&apos;t approve or sign anything else from the site that caused this. Disconnect it in your wallet&apos;s settings.</p>
          </li>
          <li>
            <p className="font-medium">Revoke token approvals, using only your wallet or the chain&apos;s own explorer.</p>
            <div className="mt-1 space-y-1 text-sm">
              {checker ? (
                <p>
                  For this coin&apos;s chain: <OfficialA link={checker} />
                </p>
              ) : (
                <p className="text-muted">
                  We don&apos;t have a verified approval checker for this coin&apos;s chain. Use your wallet&apos;s own settings to review connected sites and approvals.
                </p>
              )}
              <p>
                How it works: <OfficialA link={REVOKE_GUIDE} />
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                Wallet help: {WALLET_HELP.map((l) => <OfficialA key={l.url} link={l} />)}
              </p>
            </div>
          </li>
          <li>
            <p className="font-medium">Move what&apos;s left to a new wallet with a new seed phrase.</p>
            <p className="text-sm text-muted">
              Create the new wallet in your wallet app, write the new seed phrase on paper, and never type it into a website. If your old seed phrase was exposed,
              revoking isn&apos;t enough: the old wallet isn&apos;t safe any more.
            </p>
          </li>
          <li>
            <p className="font-medium">Never share a seed phrase or private key.</p>
            <p className="text-sm text-muted">No real support team, exchange or authority will ever ask for it.</p>
          </li>
        </ol>
        <p className="mt-4 flex gap-2 rounded-md bg-glass-strong p-3 text-sm">
          <IconTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
          Revoking approvals stops future drains, but it doesn&apos;t return stolen funds.
        </p>
      </GlassCard>
    </section>
  );
}

export function ReportWhere() {
  return (
    <GlassCard className="space-y-3">
      <h3 className="text-lg font-semibold">Where to report it</h3>
      <ul className="space-y-3 text-sm">
        <li>
          <p className="font-medium">The exchange or app you used</p>
          <p className="text-muted">Contact it through its official app or support page. Common ones:</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{EXCHANGE_SUPPORT.map((l) => <OfficialA key={l.url} link={l} />)}</p>
        </li>
        <li>
          <p className="font-medium">
            <OfficialA link={IC3} />
          </p>
          <p className="text-muted">{IC3.note}</p>
        </li>
        <li>
          <p className="font-medium">Your local police cybercrime unit</p>
          <p className="text-muted">Bring your evidence summary and screenshots.</p>
        </li>
      </ul>
    </GlassCard>
  );
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function LessonsSection({ lessons }: { lessons: Lessons }) {
  return (
    <section id="lessons" aria-labelledby="lessons-title" className="scroll-mt-24 space-y-4">
      <h2 id="lessons-title" className="text-2xl font-semibold tracking-tight">4. Lessons for next time</h2>
      <GlassCard className="space-y-4">
        <p>{lessons.summary}</p>
        {lessons.changes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted">What changed while Bag was watching</h3>
            <ul className="tabular mt-1 list-disc space-y-1 pl-5 text-sm">{lessons.changes.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
        {lessons.timeline.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted">Alerts Bag raised</h3>
            <ol className="mt-1 space-y-1 text-sm">
              {lessons.timeline.map((t, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-faint">{when(t.at)}</span>
                  <StatusPill level={t.severity} size="sm" label={t.severity === "danger" ? "Serious" : "Warning"} />
                  {t.title}
                </li>
              ))}
            </ol>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-muted">Warning signs in today&apos;s data</h3>
          {lessons.signsToday.length ? (
            <ul className="mt-1 space-y-1 text-sm">
              {lessons.signsToday.map((s) => (
                <li key={s.title}>
                  <b>{s.title}:</b> {s.meaning}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted">None of the checks show a warning sign today.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted">Next time, check</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{lessons.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </GlassCard>
    </section>
  );
}
