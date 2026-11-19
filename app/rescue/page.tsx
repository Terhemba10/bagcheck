import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Rescue plan" };

export default function RescuePage() {
  return (
    <ComingSoon
      title="Rescue plan"
      body="Can you still sell, how to protect what's left, and how to report it. This part is being built now. Until then: anyone who promises to recover lost crypto for an upfront fee is running a scam."
    />
  );
}
