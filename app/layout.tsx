import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CornerAgent } from "@/components/agent/CornerAgent";
import { SiteFooter, SiteHeader, SkipLink } from "@/components/SiteChrome";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Bagcheck", template: "%s · Bagcheck" },
  description:
    "Did the founders keep their promises, and can you still get out? Plain-English crypto risk checks built on CoinMarketCap data.",
};

export const viewport: Viewport = { themeColor: "#070b18", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <SkipLink />
        <SiteHeader />
        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
        <SiteFooter />
        <CornerAgent />
      </body>
    </html>
  );
}
