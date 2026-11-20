import type { Metadata } from "next";
import { RiskBoardView } from "@/components/risk/RiskBoardView";

export const metadata: Metadata = { title: "Risk board" };

export default function RiskBoardPage() {
  return <RiskBoardView />;
}
