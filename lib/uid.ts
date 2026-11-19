import "server-only";
import { cookies } from "next/headers";
import { isUid, newUid } from "@/lib/monitor/store";

/**
 * Anonymous web identity: a random id in an httpOnly cookie. No name, email or
 * wallet is ever collected. Clearing cookies starts a fresh watchlist (unless
 * it's linked to Telegram, where the chat keeps the alerts).
 */
export const UID_COOKIE = "bc_uid";

export async function readUid(): Promise<string | null> {
  const v = (await cookies()).get(UID_COOKIE)?.value;
  return isUid(v) && !v.startsWith("tg:") ? v : null;
}

export async function ensureUid(): Promise<string> {
  const existing = await readUid();
  if (existing) return existing;
  const uid = newUid();
  (await cookies()).set(UID_COOKIE, uid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 400 * 24 * 3600,
  });
  return uid;
}
