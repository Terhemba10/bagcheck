import type { Metadata } from "next";
import { WatchlistView } from "@/components/watch/WatchlistView";

export const metadata: Metadata = { title: "Watchlist" };

export default function WatchlistPage() {
  return <WatchlistView />;
}
