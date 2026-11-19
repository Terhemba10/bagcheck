import type { Metadata } from "next";
import { getApiStatus } from "@/lib/cmc/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "API evidence · Bagcheck" };

const CAP_LABEL = {
  available: { icon: "✓", text: "Works on this key", cls: "text-ok" },
  plan_blocked: { icon: "⛔", text: "Needs a paid plan", cls: "text-warn" },
  unknown: { icon: "•", text: "Not called yet", cls: "text-mist" },
} as const;

const MODE_LABEL = {
  full: "Full monitoring",
  lean: "Lean monitoring",
  basic: "Basic-plan monitoring",
  paused: "Monitoring paused to save credits",
} as const;

export default async function EvidencePage() {
  const s = await getApiStatus(20);
  const month = s.keyInfo?.usage.current_month;
  const day = s.keyInfo?.usage.current_day;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">API evidence</h1>
        <p className="max-w-2xl text-mist">
          Real calls Bagcheck made to the CoinMarketCap API: which endpoint, when, how many credits it used, and a
          trimmed copy of the response. All calls go through our server. The API key never reaches your browser and is
          never shown here.
        </p>
      </header>

      <section aria-labelledby="key-status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="key-status" className="sr-only">
          Key and credit status
        </h2>
        <Stat label="API key" value={s.keyConfigured ? "Configured on server" : "Not configured"} />
        <Stat
          label="Credits left this month"
          value={month?.credits_left != null ? month.credits_left.toLocaleString("en-US") : "—"}
          hint={s.keyInfo?.plan.credit_limit_monthly ? `of ${s.keyInfo.plan.credit_limit_monthly.toLocaleString("en-US")}` : undefined}
        />
        {day?.credits_left != null ? (
          <Stat label="Credits left today" value={day.credits_left.toLocaleString("en-US")} />
        ) : (
          // Basic keys report only credits used today (no daily limit given)
          <Stat label="Credits used today" value={day?.credits_used != null ? day.credits_used.toLocaleString("en-US") : "—"} />
        )}
        <Stat
          label="Watchlist monitoring"
          value={MODE_LABEL[s.governor.mode]}
          hint={`${s.governor.reason}. Checks every ${Number.isFinite(s.governor.settings.intervalHours) ? `${s.governor.settings.intervalHours} h` : "—"}`}
        />
      </section>

      {s.forcedPlan && (
        <p role="status" className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          ⚠ Simulating the CMC <strong>{s.forcedPlan}</strong> plan (CMC_FORCE_PLAN). Endpoints above that plan are
          treated as blocked.
        </p>
      )}

      <section aria-labelledby="endpoints" className="space-y-3">
        <h2 id="endpoints" className="text-xl font-semibold">
          Endpoints Bagcheck uses
        </h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-ink-800 text-mist">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Endpoint</th>
                <th scope="col" className="px-4 py-2 font-medium">Used for</th>
                <th scope="col" className="px-4 py-2 font-medium">Access on this key</th>
              </tr>
            </thead>
            <tbody>
              {s.endpoints.map((e) => {
                const c = CAP_LABEL[e.capability.state];
                return (
                  <tr key={e.key} className="border-t border-white/5">
                    <td className="px-4 py-2 font-mono text-xs">{e.path}</td>
                    <td className="px-4 py-2 text-mist">{e.purpose}</td>
                    <td className={`px-4 py-2 ${c.cls}`}>
                      <span aria-hidden="true">{c.icon}</span> {c.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="calls" className="space-y-3">
        <h2 id="calls" className="text-xl font-semibold">
          Latest real calls
        </h2>
        {s.evidence.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-ink-900 px-4 py-6 text-mist">
            No calls recorded yet. Search for a coin and its calls will show up here.
          </p>
        ) : (
          <ol className="space-y-3">
            {s.evidence.map((e) => (
              <li key={e.id} className="rounded-xl border border-white/10 bg-ink-900">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className={e.httpStatus < 300 ? "text-ok" : "text-warn"}>
                      <span aria-hidden="true">{e.httpStatus < 300 ? "✓" : "!"}</span> HTTP {e.httpStatus}
                    </span>
                    <span className="font-mono text-xs">
                      {e.method} {e.path}
                    </span>
                    <span className="text-sm text-mist">
                      <time dateTime={e.at}>{new Date(e.at).toISOString().replace("T", " ").slice(0, 19)} UTC</time>
                    </span>
                    <span className="text-sm text-mist">
                      {e.creditCount ?? "?"} credit{e.creditCount === 1 ? "" : "s"} · {e.durationMs} ms
                    </span>
                    {e.errorCode ? <span className="text-sm text-warn">error {e.errorCode}: {e.errorMessage}</span> : null}
                  </summary>
                  <div className="space-y-2 border-t border-white/5 px-4 py-3">
                    <p className="font-mono text-xs text-mist">
                      params: {Object.keys(e.params).length ? new URLSearchParams(e.params).toString() : "(none)"}
                    </p>
                    <pre className="max-h-96 overflow-auto rounded-lg bg-ink-950 p-3 font-mono text-xs leading-relaxed">
                      {JSON.stringify(e.response, null, 2)}
                    </pre>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900 p-4">
      <p className="text-sm text-mist">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-mist">{hint}</p>}
    </div>
  );
}
