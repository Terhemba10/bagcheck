import { describe, expect, it } from "vitest";
import { buildEvidenceText, EMPTY_EVIDENCE, findSecrets } from "@/lib/rescue/evidence";

const SEED = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"; // public test vector
const NOW = new Date("2026-11-20T09:30:00Z");
const COIN = { name: "Pepe", symbol: "PEPE", id: 24478 };

describe("evidence pack", () => {
  it("allows transaction hashes and wallet addresses", () => {
    const f = {
      ...EMPTY_EVIDENCE,
      txHashes: "0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b",
      walletAddresses: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    };
    expect(findSecrets(f)).toEqual([]);
    expect(buildEvidenceText(f, COIN, NOW)).toContain("0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b");
  });

  it("blocks a seed phrase or private key in ANY field, and refuses to build the file", () => {
    for (const field of Object.keys(EMPTY_EVIDENCE) as (keyof typeof EMPTY_EVIDENCE)[]) {
      const f = { ...EMPTY_EVIDENCE, [field]: `notes ${SEED}` };
      expect(findSecrets(f)).toEqual([field]);
      expect(() => buildEvidenceText(f, COIN, NOW)).toThrow();
    }
    // a 64-hex private key outside the hashes field is blocked
    expect(findSecrets({ ...EMPTY_EVIDENCE, walletAddresses: "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318" })).toEqual(["walletAddresses"]);
  });

  it("contains the coin, every section, where to report, the shield and the disclaimer", () => {
    const t = buildEvidenceText({ ...EMPTY_EVIDENCE, whatHappened: "Approved a fake airdrop site." }, COIN, NOW, ["Low concern"]);
    expect(t).toContain("Coin: Pepe (PEPE), CoinMarketCap id 24478");
    expect(t).toContain("Prepared with Covex on 2026-11-20 09:30 UTC");
    expect(t).toContain("WHAT HAPPENED\nApproved a fake airdrop site.");
    expect(t).toContain("TRANSACTION HASHES\n(not provided)");
    expect(t).toContain("https://www.ic3.gov/");
    expect(t).toContain("Your local police cybercrime unit");
    expect(t).toContain("Anyone who guarantees to recover your crypto for an upfront fee is running a scam.");
    expect(t).toContain("Covex did not upload or store it.");
    expect(t.trim().endsWith("It never tells you to buy or sell.")).toBe(true);
  });
});
