import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Connect" };

export default function ConnectPage() {
  return (
    <ComingSoon
      title="Connect Telegram and AI assistants"
      body="Get Bag's alerts on Telegram, or use Bagcheck from Claude and other AI assistants through MCP. This part is being built now."
    />
  );
}
