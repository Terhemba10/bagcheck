import { describe, expect, it } from "vitest";
import { dueEnd, findRoadmapLinks, focusOnRoadmap, htmlToText, normalizeDue, promiseStatus, quoteShowsDone, verifyQuote } from "@/lib/promises/extract";

describe("htmlToText", () => {
  it("drops scripts and styles, keeps block structure, decodes entities", () => {
    const t = htmlToText(`<html><head><title>x</title><style>.a{}</style></head><body><script>evil()</script>
      <h1>Roadmap</h1><ul><li>Q3 2026: Mainnet &amp; staking</li><li>Q4: Mobile&nbsp;app</li></ul><p>Done&#39;s</p></body></html>`);
    expect(t).not.toContain("evil");
    expect(t).not.toContain(".a{}");
    expect(t).toContain("Roadmap");
    expect(t).toContain("• Q3 2026: Mainnet & staking");
    expect(t).toContain("Mobile app");
    expect(t).toContain("Done's");
  });
});

describe("findRoadmapLinks", () => {
  const html = `
    <a href="/roadmap">Our Roadmap</a>
    <a href="https://docs.example.com/intro">Docs</a>
    <a href="https://evil.com/roadmap">Roadmap mirror</a>
    <a href="/whitepaper.pdf">Whitepaper</a>
    <a href="https://example.gitbook.io/x">Litepaper</a>
    <a href="/about">About</a>`;
  it("prefers roadmap, then whitepaper/litepaper; skips PDFs, other sites and plain docs when better links exist", () => {
    expect(findRoadmapLinks(html, "https://www.example.com/", 3)).toEqual([
      "https://www.example.com/roadmap",
      "https://example.gitbook.io/x",
    ]);
  });
  it("skips developer / API documentation pages", () => {
    const dev = `<a href="/auth.md">Docs</a><a href="/developers/api">API docs</a><a href="/sdk/reference">SDK</a><a href="/roadmap">Roadmap</a>`;
    expect(findRoadmapLinks(dev, "https://www.example.com/", 3)).toEqual(["https://www.example.com/roadmap"]);
  });
  it("falls back to plain docs links when nothing better exists", () => {
    expect(findRoadmapLinks(`<a href="https://docs.example.com/intro">Docs</a>`, "https://www.example.com/", 2)).toEqual(["https://docs.example.com/intro"]);
  });
});

describe("focusOnRoadmap", () => {
  it("keeps the roadmap section of a long page", () => {
    const text = "intro ".repeat(5000) + "Roadmap Q3 2026 mainnet launch" + " outro".repeat(5000);
    const out = focusOnRoadmap(text, 2000);
    expect(out.length).toBe(2000);
    expect(out).toContain("Roadmap Q3 2026 mainnet launch");
  });
  it("leaves short pages alone", () => {
    expect(focusOnRoadmap("short", 100)).toBe("short");
  });
});

describe("verifyQuote", () => {
  const page = "Our team will launch Mainnet in Q3 2026 with staking enabled for all holders.";
  it("accepts a word-for-word quote (case, quotes and spacing ignored)", () => {
    expect(verifyQuote("“launch mainnet  in Q3 2026”", page)).toBe("launch mainnet in Q3 2026");
  });
  it("rejects anything the page doesn't say", () => {
    expect(verifyQuote("launch mainnet in Q2 2026", page)).toBeNull();
    expect(verifyQuote("guaranteed 100x returns for holders", page)).toBeNull();
  });
  it("cuts quotes to 15 words", () => {
    const long = "a b c d e f g h i j k l m n o p q r";
    expect(verifyQuote(long, long)!.split(" ")).toHaveLength(15);
  });
  it("rejects too-short quotes", () => {
    expect(verifyQuote("staking", page)).toBeNull();
  });
});

describe("quoteShowsDone", () => {
  it("only accepts completion evidence in the quote itself", () => {
    expect(quoteShowsDone("LIVE NOW - $ICNT ON BYBIT")).toBe(true);
    expect(quoteShowsDone("Mainnet launched in March with staking")).toBe(true);
    expect(quoteShowsDone("2026 Q2: Introduce the Pieverse DAO for community-led governance.")).toBe(false);
  });
});

describe("dates and status", () => {
  it.each([
    ["2026", "2026"],
    ["Q3 2026", "2026-Q3"],
    ["2026-q4", "2026-Q4"],
    ["H1 2027", "2027-Q2"],
    ["2026-09", "2026-09"],
    ["2026-09-30", "2026-09-30"],
    ["soon", null],
    ["", null],
    ["2026-13", null],
  ])("normalizeDue(%s) = %s", (raw, out) => expect(normalizeDue(raw)).toBe(out));

  it("computes the end of each period", () => {
    expect(dueEnd("2026-Q3").toISOString()).toBe("2026-09-30T23:59:59.999Z");
    expect(dueEnd("2026-02").toISOString()).toBe("2026-02-28T23:59:59.999Z");
    expect(dueEnd("2026").toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });

  it("status is computed in code", () => {
    const now = new Date("2026-11-19T00:00:00Z");
    expect(promiseStatus("2026-Q3", now)).toBe("overdue");
    expect(promiseStatus("2026-12", now)).toBe("due-soon");
    expect(promiseStatus("2027-Q2", now)).toBe("upcoming");
    expect(promiseStatus(null, now)).toBe("no-date");
    expect(promiseStatus("2026-Q3", now, true)).toBe("delivered");
  });
});
