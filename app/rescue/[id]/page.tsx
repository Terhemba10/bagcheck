import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RescueView } from "@/components/rescue/RescueView";

export const metadata: Metadata = { title: "Rescue plan" };

export default async function RescueCoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return <RescueView id={n} />;
}
