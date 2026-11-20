import type { Metadata } from "next";
import { DISCLAIMER } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Not financial advice</h1>
      <p className="text-lg">{DISCLAIMER}</p>
      <div className="space-y-4 text-muted">
        <p>
          Covex explains what live CoinMarketCap data and a project&apos;s own pages show. Scores, thresholds and alerts are computed in code from that data;
          the AI only extracts promises (kept only when the quote appears word for word on the cited page) and explains answers using the report&apos;s numbers.
        </p>
        <p>
          Covex shows warning signs and the evidence behind them. It never calls a coin a scam, never says buy or sell, and can be wrong when the data is
          wrong, late or missing. Price-impact figures are estimates from a simple pool model.
        </p>
        <p>
          Covex never asks for a seed phrase or private key. Anyone who does, or who promises to recover lost crypto for an upfront fee, is running a scam.
        </p>
      </div>
    </article>
  );
}
