/**
 * Evidence summary, built entirely in the browser (nothing is uploaded).
 * Every field goes through the seed-phrase / private-key blocker before
 * anything is shown, kept or downloaded. Pure, unit-tested.
 */
import { detectSecret } from "@/lib/safety/secrets";

export interface EvidenceFields {
  whatHappened: string;
  dates: string;
  walletAddresses: string;
  txHashes: string;
  amounts: string;
  exchange: string;
  sitesAndContacts: string;
  screenshots: string;
}

export const EVIDENCE_LABELS: Record<keyof EvidenceFields, { label: string; hint: string; multiline?: boolean }> = {
  whatHappened: { label: "What happened", hint: "In your own words: what you did, what you saw, what went missing.", multiline: true },
  dates: { label: "Dates and times", hint: "When it happened (with your time zone), e.g. 18 Nov 2026, 21:40 GMT+3.", multiline: true },
  walletAddresses: { label: "Your wallet address(es)", hint: "Public addresses only (they start with 0x… or similar). Never your seed phrase or private key.", multiline: true },
  txHashes: { label: "Transaction hashes", hint: "One per line, from your wallet or a block explorer.", multiline: true },
  amounts: { label: "Amounts lost", hint: "Coin and amount, e.g. 1,200,000 PEPE.", multiline: true },
  exchange: { label: "Exchange or app used", hint: "e.g. the exchange where you bought or sold." },
  sitesAndContacts: { label: "Websites, accounts or people involved", hint: "Site addresses, usernames, phone numbers that contacted you.", multiline: true },
  screenshots: { label: "Screenshots you've saved", hint: "File names, so you can attach them to a report.", multiline: true },
};

export const EMPTY_EVIDENCE: EvidenceFields = { whatHappened: "", dates: "", walletAddresses: "", txHashes: "", amounts: "", exchange: "", sitesAndContacts: "", screenshots: "" };

/** Fields that contain a seed phrase or private key (transaction hashes allowed in the hashes field only). */
export function findSecrets(f: EvidenceFields): (keyof EvidenceFields)[] {
  return (Object.keys(f) as (keyof EvidenceFields)[]).filter((k) => detectSecret(f[k], { allowTxHashes: k === "txHashes" }) !== null);
}

export function buildEvidenceText(f: EvidenceFields, coin: { name: string; symbol: string; id: number } | null, now: Date, facts: string[] = []): string {
  if (findSecrets(f).length) throw new Error("Evidence contains a seed phrase or private key");
  const line = "=".repeat(64);
  const section = (k: keyof EvidenceFields) => {
    const v = f[k].trim();
    return `${EVIDENCE_LABELS[k].label.toUpperCase()}\n${v || "(not provided)"}\n`;
  };
  return [
    line,
    "EVIDENCE SUMMARY",
    `Prepared with Covex on ${now.toISOString().replace("T", " ").slice(0, 16)} UTC`,
    coin ? `Coin: ${coin.name} (${coin.symbol}), CoinMarketCap id ${coin.id}` : "Coin: (not specified)",
    line,
    "",
    ...(Object.keys(EVIDENCE_LABELS) as (keyof EvidenceFields)[]).map(section),
    ...(facts.length ? ["CONTEXT FROM COVEX (live CoinMarketCap data at the time of writing)", ...facts.map((x) => `- ${x}`), ""] : []),
    "WHERE TO REPORT",
    "- The exchange or app you used (through its official support page or app)",
    "- United States: FBI Internet Crime Complaint Center, https://www.ic3.gov/",
    "- Your local police cybercrime unit",
    "",
    "IMPORTANT",
    "- Never share your seed phrase or private key with anyone, including people who offer to help.",
    "- Anyone who guarantees to recover your crypto for an upfront fee is running a scam. Real authorities never charge recovery fees.",
    "- This summary was created on your device. Covex did not upload or store it.",
    "",
    "Not financial advice. Covex explains data. It never tells you to buy or sell.",
    "",
  ].join("\n");
}
