import { describe, expect, it } from "vitest";
import { detectSecret } from "@/lib/safety/secrets";

// The well-known BIP-39 test vector (all "abandon" + "about"); never a real wallet.
const TEST_SEED = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("seed phrase / private key blocker", () => {
  it("blocks a 12-word seed phrase, even inside a sentence", () => {
    expect(detectSecret(TEST_SEED)?.kind).toBe("seed_phrase");
    expect(detectSecret(`hi bag my words are ${TEST_SEED} is my wallet safe?`)?.kind).toBe("seed_phrase");
    expect(detectSecret(TEST_SEED.toUpperCase().split(" ").join(", "))?.kind).toBe("seed_phrase");
  });
  it("blocks a 24-word phrase", () => {
    expect(detectSecret(`${TEST_SEED} ${TEST_SEED}`)?.kind).toBe("seed_phrase");
  });
  it("blocks hex private keys", () => {
    expect(detectSecret("my key is 4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318")?.kind).toBe("private_key");
    expect(detectSecret("0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318")?.kind).toBe("private_key");
  });
  it("allows 0x transaction hashes only where hashes are expected", () => {
    const tx = "0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b";
    expect(detectSecret(tx, { allowTxHashes: true })).toBeNull();
    expect(detectSecret(tx)?.kind).toBe("private_key");
  });
  it("blocks a Solana keypair array", () => {
    const arr = `[${Array.from({ length: 64 }, (_, i) => (i * 7) % 256).join(",")}]`;
    expect(detectSecret(arr)?.kind).toBe("solana_secret");
  });
  it("blocks an extended private key", () => {
    expect(detectSecret("xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi")?.kind).toBe("extended_key");
  });
  it.each([
    "Why is this coin medium concern?",
    "What does dilution mean here, and can I still sell if the liquidity drops?",
    "Is the team about to unlock a lot of tokens soon or later this year?",
    "0x6982508145454ce325ddbe47a25d4ec3d2311933", // a contract address (40 hex) is fine
    "Pepe has $27.4M in DEX pools and 100% of supply released",
  ])("lets normal questions through: %s", (q) => {
    expect(detectSecret(q)).toBeNull();
  });
});
