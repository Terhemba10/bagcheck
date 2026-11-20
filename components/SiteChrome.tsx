import Link from "next/link";
import { DISCLAIMER } from "@/components/ui/Notice";

/** Slim footer under every page (navigation lives in the sidebar). */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:px-6 lg:px-10">
        <p className="font-medium text-text">{DISCLAIMER}</p>
        <p>
          Market data from the{" "}
          <a href="https://coinmarketcap.com/api/" className="text-teal underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
            CoinMarketCap API
          </a>
          . Covex shows warning signs and evidence; it never calls a coin a scam.
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/disclaimer" className="hover:text-text">Disclaimer</Link>
          <Link href="/design" className="hover:text-text">Design system</Link>
          <Link href="/evidence" className="hover:text-text">API evidence</Link>
          <a href="https://github.com/Terhemba10/covex" className="hover:text-text" target="_blank" rel="noopener noreferrer">Source</a>
        </p>
      </div>
    </footer>
  );
}
