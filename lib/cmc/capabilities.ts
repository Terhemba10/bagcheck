import { kv } from "@/lib/store/kv";
import { ENDPOINTS, planAllows, type EndpointKey, type Plan } from "./endpoints";

/**
 * Live record of which endpoints the current key can use. Filled in from real
 * responses: a 1006 marks an endpoint `plan_blocked` for 24 h, a success marks
 * it `available`. This is how Bagcheck adapts when the key drops from Startup
 * to Basic after 9 Dec without a redeploy.
 */
export type Capability = "available" | "plan_blocked" | "unknown";

export interface CapabilityRecord {
  state: Capability;
  checkedAt: string;
  code?: number;
}

const KEY = (e: EndpointKey) => `cmc:cap:${e}`;
const BLOCK_TTL = 24 * 3600;
const OK_TTL = 6 * 3600;

/** `CMC_FORCE_PLAN=basic` makes Startup-only endpoints behave as blocked. */
export function forcedPlan(): Plan | null {
  const v = process.env.CMC_FORCE_PLAN?.trim().toLowerCase();
  return v === "basic" || v === "builder" || v === "startup" ? v : null;
}

export function isForcedBlocked(endpoint: EndpointKey): boolean {
  const plan = forcedPlan();
  return plan !== null && !planAllows(plan, ENDPOINTS[endpoint].minPlan);
}

export async function getCapability(endpoint: EndpointKey): Promise<CapabilityRecord> {
  if (isForcedBlocked(endpoint))
    return { state: "plan_blocked", checkedAt: new Date().toISOString(), code: 1006 };
  return (
    (await kv().get<CapabilityRecord>(KEY(endpoint))) ?? {
      state: "unknown",
      checkedAt: new Date(0).toISOString(),
    }
  );
}

export async function markCapability(endpoint: EndpointKey, state: Exclude<Capability, "unknown">, code?: number) {
  await kv().set<CapabilityRecord>(
    KEY(endpoint),
    { state, checkedAt: new Date().toISOString(), code },
    state === "plan_blocked" ? BLOCK_TTL : OK_TTL,
  );
}

export async function allCapabilities(): Promise<Record<EndpointKey, CapabilityRecord>> {
  const keys = Object.keys(ENDPOINTS) as EndpointKey[];
  const records = await Promise.all(keys.map(getCapability));
  return Object.fromEntries(keys.map((k, i) => [k, records[i]!])) as Record<EndpointKey, CapabilityRecord>;
}
