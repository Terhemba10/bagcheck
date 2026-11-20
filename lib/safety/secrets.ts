/**
 * Seed-phrase and private-key blocker. Pure, unit-tested, used in the browser
 * (so secrets are never sent) and again on the server.
 *
 * Covex never asks for, accepts, stores or logs these.
 */
import { wordlist } from "@scure/bip39/wordlists/english.js";

const BIP39 = new Set(wordlist);

export type SecretKind = "seed_phrase" | "private_key" | "solana_secret" | "wif_key" | "extended_key";

export interface SecretHit {
  kind: SecretKind;
  message: string;
}

const SECRET_ADVICE =
  "Never share it with anyone: Covex, support staff and real authorities will never ask for it. If you've already shared it, move your funds to a new wallet with a new seed phrase.";

/** For things that would be sent (chat, Telegram). */
export const SECRET_WARNING = `That looks like a seed phrase or private key, so it wasn't sent. ${SECRET_ADVICE}`;

/** For the evidence form, where nothing is ever sent: it's the saving/downloading we stop. */
export const SECRET_WARNING_SAVED = `That looks like a seed phrase or private key, so it wasn't saved. ${SECRET_ADVICE}`;

/**
 * 12+ consecutive words that are ALL on the BIP-39 list. Normal sentences
 * contain words like "the", "is", "a" or "I" that aren't on the list, so
 * they don't trip this.
 */
function hasSeedPhrase(text: string): boolean {
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let run = 0;
  for (const w of words) {
    run = BIP39.has(w) ? run + 1 : 0;
    if (run >= 12) return true;
  }
  return false;
}

export function detectSecret(text: string, opts: { allowTxHashes?: boolean } = {}): SecretHit | null {
  if (!text) return null;
  if (hasSeedPhrase(text)) return { kind: "seed_phrase", message: SECRET_WARNING };
  if (/\b[xyzt]prv[1-9A-HJ-NP-Za-km-z]{100,}\b/.test(text)) return { kind: "extended_key", message: SECRET_WARNING };
  // 64 hex chars = EVM/Bitcoin private key (an EVM transaction hash has the same shape: allowed only where hashes are expected)
  const hex64 = /(?<![0-9a-fA-F])(0x)?[0-9a-fA-F]{64}(?![0-9a-fA-F])/.exec(text);
  if (hex64 && !(opts.allowTxHashes && hex64[1])) return { kind: "private_key", message: SECRET_WARNING };
  // Solana secret key (base58, 87–88 chars) or a keypair file (JSON array of 64 numbers)
  if (/(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{87,88}(?![1-9A-HJ-NP-Za-km-z])/.test(text)) return { kind: "solana_secret", message: SECRET_WARNING };
  if (/\[\s*(\d{1,3}\s*,\s*){63}\d{1,3}\s*\]/.test(text)) return { kind: "solana_secret", message: SECRET_WARNING };
  // Bitcoin WIF private key
  if (/(?<![1-9A-HJ-NP-Za-km-z])[5KL][1-9A-HJ-NP-Za-km-z]{50,51}(?![1-9A-HJ-NP-Za-km-z])/.test(text)) return { kind: "wif_key", message: SECRET_WARNING };
  return null;
}
