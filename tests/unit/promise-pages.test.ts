import { describe, expect, it, vi } from "vitest";
import type { LlmProvider } from "@/lib/llm/types";
import { memoryKV } from "@/lib/store/kv";
import {
  CHUNK_SIZE,
  PAGE_CACHE_TTL,
  chunkText,
  dedupe,
  extractPage,
  mergeExtractions,
  readOnLabel,
  type PageExtraction,
} from "@/lib/promises/pages";

// Saved page text (trimmed from a real roadmap page, 19 Nov 2026).
const PAGE = {
  url: "https://www.example-project.io/whitepaper",
  text: [
    "Pieverse whitepaper",
    "Roadmap",
    "2025 Q4: Launch of the Pieverse Timestamping MVP with multi-jurisdiction invoicing and receipt generation.",
    "Token Generation Event (TGE) and initial exchange listings.",
    "2026 Q1: Launch marketplace features and expand the project growth toolkit.",
    "2026 Q2: Introduce the Pieverse DAO for community-led governance.",
    "2026 Q4: Global expansion with localized compliance features for key markets.",
  ].join("\n\n"),
};
const COIN = { name: "Pieverse", symbol: "PIEVERSE" };
const NOW = new Date("2026-11-20T09:00:00Z");

/** A fake LLM that returns a scripted answer and counts its calls. */
function fakeLlm(items: Record<string, unknown>[]): LlmProvider & { calls: number } {
  const p = {
    name: "fake",
    calls: 0,
    configured: () => true,
    async json() {
      p.calls++;
      return { promises: items } as never;
    },
  };
  return p;
}

const AI_ITEMS = [
  { promise: "Introduce the Pieverse DAO", dueDate: "2026 Q2", sourceUrl: PAGE.url, quote: "Introduce the Pieverse DAO for community-led governance.", kind: "commitment" },
  { promise: "Launch Timestamping MVP", dueDate: "Q4 2025", sourceUrl: PAGE.url, quote: "Launch of the Pieverse Timestamping MVP", kind: "commitment", alreadyDone: true },
  { promise: "Global expansion with compliance features", dueDate: "2026-Q4", sourceUrl: PAGE.url, quote: "Global expansion with localized compliance features for key markets.", kind: "commitment" },
  { promise: "Made-up listing on a major exchange", dueDate: "2026-Q1", sourceUrl: PAGE.url, quote: "Listing on Binance guaranteed in January", kind: "commitment" }, // not on the page
  { promise: "Existing feature", dueDate: null, sourceUrl: PAGE.url, quote: "Token Generation Event (TGE) and initial exchange listings.", kind: "existing" },
];

describe("promise extraction is deterministic and cached", () => {
  it("same saved page text twice → identical items, and the AI is only called the first time", async () => {
    const store = memoryKV();
    const ai = fakeLlm(AI_ITEMS);
    const first = await extractPage(PAGE, COIN, { llm: ai, kv: store, now: NOW });
    const callsAfterFirst = ai.calls;
    const second = await extractPage(PAGE, COIN, { llm: ai, kv: store, now: new Date("2026-11-21T09:00:00Z") });

    expect(second.items).toEqual(first.items);
    expect(second.cached).toBe(true);
    expect(second.extractedAt).toBe(first.extractedAt); // "read on" stays the day it was read
    expect(ai.calls).toBe(callsAfterFirst);
    // verification: the invented quote is dropped, the "existing" item is skipped
    expect(first.items.map((i) => i.dueDate)).toEqual(["2025-Q4", "2026-Q2", "2026-Q4"]);
    expect(first.dropped).toBe(1);
    // "done" needs evidence in the quote: this one has none, so it isn't delivered
    expect(first.items[0]!.done).toBe(false);
  });

  it("re-extracts when the page text changes", async () => {
    const store = memoryKV();
    const ai = fakeLlm(AI_ITEMS);
    await extractPage(PAGE, COIN, { llm: ai, kv: store, now: NOW });
    const calls = ai.calls;
    await extractPage({ ...PAGE, text: PAGE.text + "\n\n2027 Q1: Mobile app." }, COIN, { llm: ai, kv: store, now: NOW });
    expect(ai.calls).toBeGreaterThan(calls);
  });

  it("asks the AI at temperature 0", async () => {
    const ai = fakeLlm([]);
    const spy = vi.spyOn(ai, "json");
    await extractPage(PAGE, COIN, { llm: ai, kv: memoryKV(), now: NOW });
    expect(spy.mock.calls[0]![0].temperature).toBe(0);
  });

  it("caches for 7 days", async () => {
    const store = memoryKV();
    const setSpy = vi.spyOn(store, "set");
    await extractPage(PAGE, COIN, { llm: fakeLlm([]), kv: store, now: NOW });
    expect(setSpy.mock.calls[0]![2]).toBe(PAGE_CACHE_TTL);
    expect(PAGE_CACHE_TTL).toBe(7 * 24 * 3600);
  });
});

describe("chunking", () => {
  it("is stable and never exceeds the chunk size", () => {
    const long = Array.from({ length: 400 }, (_, i) => `Paragraph ${i}: ${"word ".repeat(20)}`).join("\n\n");
    const a = chunkText(long);
    const b = chunkText(long);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(1);
    expect(Math.max(...a.map((c) => c.length))).toBeLessThanOrEqual(CHUNK_SIZE);
    // nothing lost: every paragraph number survives
    expect(a.join("\n\n")).toContain("Paragraph 399:");
  });
});

describe("merge", () => {
  const ext = (url: string, items: PageExtraction["items"]): PageExtraction => ({ url, textHash: "x", items, dropped: 0, extractedAt: NOW.toISOString() });
  const A = { promise: "Launch mainnet", dueDate: "2026-Q3", quote: "We will launch mainnet in Q3 2026", done: false, pos: 3 };
  const B = { promise: "Public audit", dueDate: "2026-12", quote: "A third-party audit will be published in December", done: false, pos: 7 };

  it("gives the same order whatever order the items arrive in", () => {
    const one = mergeExtractions([ext("https://a.io", [A, B])], NOW);
    const two = mergeExtractions([ext("https://a.io", [B, A])], NOW);
    expect(one).toEqual(two);
  });

  it("de-duplicates the same promise + date across pages (first page wins)", () => {
    const merged = mergeExtractions([ext("https://a.io", [A]), ext("https://a.io/roadmap", [{ ...A, quote: "Mainnet launches Q3 2026" }])], NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.sourceUrl).toBe("https://a.io");
  });

  it("de-duplicates identical quotes even if the AI summarised them differently", () => {
    expect(dedupe([A, { ...A, promise: "Mainnet go-live" }])).toHaveLength(1);
  });

  it("computes status from the date at merge time", () => {
    const merged = mergeExtractions([ext("https://a.io", [A, B])], NOW);
    expect(merged.map((m) => m.status)).toEqual(["overdue", "due-soon"]);
  });
});

describe("canonical quotes", () => {
  it("gives the same quote however the AI cut it", async () => {
    const store = memoryKV();
    const short = await extractPage(PAGE, COIN, { llm: fakeLlm([{ promise: "Marketplace", dueDate: "2026 Q1", sourceUrl: PAGE.url, quote: "2026 Q1: Launch marketplace features and expand", kind: "commitment" }]), kv: store, now: NOW });
    const long = await extractPage(PAGE, COIN, { llm: fakeLlm([{ promise: "Marketplace", dueDate: "2026 Q1", sourceUrl: PAGE.url, quote: "2026 Q1: Launch marketplace features and expand the project growth toolkit.", kind: "commitment" }]), kv: memoryKV(), now: NOW });
    expect(short.items[0]!.quote).toBe(long.items[0]!.quote);
    expect(short.items[0]!.quote.split(" ").length).toBeLessThanOrEqual(15);
  });
  it("uses the whole sentence, even when several sentences share a line", async () => {
    const page = { url: PAGE.url, text: "Roadmap\n\n2025 Q4: Launch of the MVP with invoicing. Token Generation Event (TGE) and listings. 2026 Q1: Marketplace." };
    const fromMiddle = await extractPage(page, COIN, { llm: fakeLlm([{ promise: "TGE", dueDate: "2025 Q4", sourceUrl: PAGE.url, quote: "Generation Event (TGE) and", kind: "commitment" }]), kv: memoryKV(), now: NOW });
    expect(fromMiddle.items[0]!.quote).toBe("Token Generation Event (TGE) and listings.");
    const withLabel = await extractPage(page, COIN, { llm: fakeLlm([{ promise: "MVP", dueDate: "2025 Q4", sourceUrl: PAGE.url, quote: "Launch of the MVP", kind: "commitment" }]), kv: memoryKV(), now: NOW });
    expect(withLabel.items[0]!.quote).toBe("2025 Q4: Launch of the MVP with invoicing.");
    const bulleted = await extractPage({ url: PAGE.url, text: "Roadmap\n• 2026 Q2: Introduce the DAO for governance." }, COIN, { llm: fakeLlm([{ promise: "DAO", dueDate: "2026 Q2", sourceUrl: PAGE.url, quote: "Introduce the DAO", kind: "commitment" }]), kv: memoryKV(), now: NOW });
    expect(bulleted.items[0]!.quote).toBe("2026 Q2: Introduce the DAO for governance.");
  });
  it("orders same-date items by their position on the page", async () => {
    const ai = fakeLlm([
      { promise: "B", dueDate: "2026 Q2", sourceUrl: PAGE.url, quote: "Introduce the Pieverse DAO for community-led governance.", kind: "commitment" },
      { promise: "A", dueDate: "2026 Q2", sourceUrl: PAGE.url, quote: "2026 Q1: Launch marketplace features", kind: "commitment" },
    ]);
    const r = await extractPage(PAGE, COIN, { llm: ai, kv: memoryKV(), now: NOW });
    // "2026 Q1: Launch marketplace…" sits higher on the page, so it comes first
    expect(r.items.map((i) => i.promise)).toEqual(["A", "B"]);
  });
});

describe("read-on label", () => {
  it("shows one date, or a range", () => {
    expect(readOnLabel(["2026-11-20T09:00:00Z", "2026-11-20T10:00:00Z"])).toBe("Read on 20 Nov 2026");
    expect(readOnLabel(["2026-11-14T09:00:00Z", "2026-11-20T10:00:00Z"])).toBe("Read between 14 Nov 2026 and 20 Nov 2026");
    expect(readOnLabel([])).toBeNull();
  });
});
