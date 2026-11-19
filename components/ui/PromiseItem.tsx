import { cn } from "@/lib/cn";
import { IconCheck, IconClock, IconExternal, IconQuestion, IconTriangle, IconWatch } from "./icons";

export type PromiseStatus = "upcoming" | "due-soon" | "overdue" | "delivered" | "no-date";

const STATUS = {
  upcoming: { label: "Upcoming", Icon: IconClock, cls: "text-muted", dot: "bg-muted" },
  "due-soon": { label: "Due soon", Icon: IconWatch, cls: "text-teal", dot: "bg-teal" },
  // We only know the date has passed, not whether it was delivered: say exactly that.
  overdue: { label: "Date passed: delivered?", Icon: IconTriangle, cls: "text-warn", dot: "bg-warn" },
  delivered: { label: "Marked delivered", Icon: IconCheck, cls: "text-ok", dot: "bg-ok" },
  "no-date": { label: "No date given", Icon: IconQuestion, cls: "text-faint", dot: "bg-faint" },
} as const;

export interface PromiseItemProps {
  promise: string;
  dueDate: string | null;
  /** ≤ 15 words, verbatim from the source page. */
  quote: string;
  sourceUrl: string;
  status: PromiseStatus;
}

/** One row of the promise timeline. Use inside an <ol>. */
export function PromiseItem({ promise, dueDate, quote, sourceUrl, status }: PromiseItemProps) {
  const s = STATUS[status];
  let host = sourceUrl;
  try {
    host = new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  return (
    <li className="group relative grid grid-cols-[1.25rem_1fr] gap-x-4 pb-6 last:pb-0">
      <span aria-hidden="true" className="absolute top-5 bottom-0 left-[0.55rem] w-px bg-line group-last:hidden" />
      <span aria-hidden="true" className={cn("mt-1.5 size-3 rounded-full ring-4 ring-bg", s.dot)} />
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="tabular font-medium">{dueDate ? formatDue(dueDate) : "No date"}</span>
          <span className={cn("inline-flex items-center gap-1", s.cls)}>
            <s.Icon className="size-4" />
            {s.label}
          </span>
        </div>
        <p className="font-medium">{promise}</p>
        <blockquote className="border-l-2 border-line pl-3 text-sm text-muted italic">“{quote}”</blockquote>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 text-xs text-teal underline-offset-2 hover:underline"
        >
          Source: {host} <IconExternal className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </li>
  );
}

function formatDue(d: string) {
  // accept "2025", "2025-Q3", "2025-09", full ISO dates
  if (/^\d{4}$/.test(d)) return d;
  const q = /^(\d{4})-Q([1-4])$/.exec(d);
  if (q) return `Q${q[2]} ${q[1]}`;
  const t = Date.parse(d.length === 7 ? `${d}-01` : d);
  if (Number.isNaN(t)) return d;
  return new Date(t).toLocaleDateString("en-GB", { month: "short", year: "numeric", ...(d.length > 7 ? { day: "numeric" } : {}), timeZone: "UTC" });
}
