import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bagcheck",
  description: "Did the founders keep their promises, and can you still get out? Plain-English crypto risk checks built on CoinMarketCap data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-white/5">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 text-sm" aria-label="Main">
            <Link href="/" className="font-semibold tracking-tight text-white">
              Bagcheck
            </Link>
            <Link href="/evidence" className="text-mist hover:text-white">
              API evidence
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
