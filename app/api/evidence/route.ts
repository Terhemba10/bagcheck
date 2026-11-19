import { NextResponse } from "next/server";
import { getApiStatus } from "@/lib/cmc/status";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const count = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get("count")) || 20));
  try {
    return NextResponse.json(await getApiStatus(count));
  } catch (err) {
    return errorResponse(err);
  }
}
