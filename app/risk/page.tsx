import type { Metadata } from "next";
import { RiskBoardView } from "@/components/risk/RiskBoardView";
import { readCachedBoard } from "@/lib/core/riskBoardBuild";

export const metadata: Metadata = { title: "Risk board" };
export const dynamic = "force-dynamic";

/** First paint uses the cached board when there is one (a storage read, no CMC calls). */
export default async function RiskBoardPage() {
  const initial = await readCachedBoard();
  return <RiskBoardView initial={initial} />;
}
