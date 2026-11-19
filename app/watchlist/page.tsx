import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Watchlist" };

export default function WatchlistPage() {
  return (
    <ComingSoon
      title="Your watchlist"
      body="Bag will re-check the coins you hold and warn you on Telegram when promises slip or warning signs appear. This part is being built now."
    />
  );
}
