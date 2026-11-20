import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteChrome";
import { AppShell } from "@/components/shell/AppShell";
import { BOOT_SCRIPT } from "@/lib/client/graphics";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

const DESCRIPTION =
  "Covex is an AI agent for crypto holders: did the founders keep their promises, and can you still get out? Plain-English risk checks, watchlist alerts and rescue plans built on live CoinMarketCap data.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://covex-ai.vercel.app"),
  title: { default: "Covex: crypto risk agent", template: "%s · Covex" },
  description: DESCRIPTION,
  applicationName: "Covex",
  openGraph: { title: "Covex", description: DESCRIPTION, siteName: "Covex", type: "website" },
  twitter: { card: "summary", title: "Covex", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* sidebar width + graphics mode before first paint (no layout jump) */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-black font-sans antialiased">
        <AppShell footer={<SiteFooter />}>{children}</AppShell>
      </body>
    </html>
  );
}
