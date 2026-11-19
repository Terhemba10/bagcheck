import { NextResponse } from "next/server";
import { searchCoins } from "@/lib/cmc/api";
import { errorResponse } from "@/lib/http";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1 || q.length > 64) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await searchCoins(q) });
  } catch (err) {
    return errorResponse(err);
  }
}
