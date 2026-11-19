import "server-only";
import { storeBackend } from "@/lib/store/kv";
import { getKeyInfo } from "./api";
import { allCapabilities, forcedPlan } from "./capabilities";
import { creditsUsedToday } from "./client";
import { decideMode } from "./budget";
import { ENDPOINTS } from "./endpoints";
import { listEvidence } from "./evidence";

/** Everything the /evidence page shows. Never includes the key. */
export async function getApiStatus(count = 20, watchedCoins = 0) {
  const [keyInfo, capabilities, evidence, usedToday] = await Promise.all([
    getKeyInfo(),
    allCapabilities(),
    listEvidence(count),
    creditsUsedToday(),
  ]);
  return {
    keyConfigured: Boolean(process.env.CMC_API_KEY),
    forcedPlan: forcedPlan(),
    store: storeBackend(),
    keyInfo: keyInfo ? { plan: keyInfo.plan, usage: keyInfo.usage } : null,
    governor: decideMode(keyInfo, watchedCoins),
    creditsUsedTodayLocal: usedToday,
    endpoints: Object.entries(ENDPOINTS).map(([key, def]) => ({
      key,
      path: def.path,
      purpose: def.purpose,
      docsMinPlan: def.minPlan,
      capability: capabilities[key as keyof typeof ENDPOINTS],
    })),
    evidence,
  };
}

export type ApiStatus = Awaited<ReturnType<typeof getApiStatus>>;
