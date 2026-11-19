import Link from "next/link";
import { GraphicsToggle } from "@/components/agent/GraphicsToggle";
import { MobileMenu } from "@/components/MobileMenu";
import { DISCLAIMER } from "@/components/ui/Notice";

const NAV = [
  { href: "/", label: "Check a coin" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/rescue", label: "Rescue" },
  { href: "/connect", label: "Connect" },
  { href: "/evidence", label: "API evidence" },
];

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-md bg-teal px-4 py-2 font-medium text-teal-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to content
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-14 items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden="true" className="size-6 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0%,#3ee6c8_35%,#0c1a3a_80%)] shadow-[0_0_14px_rgb(62_230_200/.6)]" />
          Bagcheck
        </Link>
        <div className="ml-auto md:hidden">
          <MobileMenu items={NAV} />
        </div>
        <nav aria-label="Main" className="-mr-2 ml-auto hidden md:block">
          <ul className="flex items-center gap-1 text-sm whitespace-nowrap">
            {NAV.slice(1).map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="inline-flex min-h-11 items-center rounded-md px-3 text-muted hover:bg-glass hover:text-text">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted sm:px-6 lg:px-8">
        <p className="font-medium text-text">{DISCLAIMER}</p>
        <p>
          Market data from the{" "}
          <a href="https://coinmarketcap.com/api/" className="text-teal underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
            CoinMarketCap API
          </a>
          . Bagcheck shows warning signs and evidence; it never calls a coin a scam.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <GraphicsToggle />
          <Link href="/design" className="hover:text-text">Design system</Link>
          <Link href="/evidence" className="hover:text-text">API evidence</Link>
        </div>
      </div>
    </footer>
  );
}
