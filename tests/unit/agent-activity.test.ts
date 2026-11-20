import { describe, expect, it } from "vitest";
import { activeNavId, NAV } from "@/components/shell/nav";
import { parse } from "@/components/motion/CountUp";
import { compactCredits, planSummary } from "@/lib/cmc/planLabel";
import { allFromCache, applyStep, initialSteps, isFinished, progress, REPORT_STEPS, sourceNote } from "@/lib/core/steps";
import { duration, TILT_MAX_DEG } from "@/lib/motion";

describe("agent activity steps", () => {
  it("starts with every step pending, in order, each with a data source", () => {
    const s = initialSteps();
    expect(s.map((x) => x.id)).toEqual(REPORT_STEPS.map((d) => d.id));
    expect(s.every((x) => x.status === "pending")).toBe(true);
    for (const d of REPORT_STEPS) expect(d.source.length).toBeGreaterThan(3);
  });

  it("ticks pending → running → done and counts progress", () => {
    let s = initialSteps();
    s = applyStep(s, { type: "step", id: "profile", status: "running" });
    expect(s[0]!.status).toBe("running");
    expect(progress(s).finished).toBe(0);
    s = applyStep(s, { type: "step", id: "profile", status: "done", note: "live" });
    expect(s[0]).toEqual({ id: "profile", status: "done", note: "live" });
    expect(progress(s)).toEqual({ finished: 1, total: REPORT_STEPS.length });
  });

  it("ignores a late 'running' after a step finished", () => {
    let s = applyStep(initialSteps(), { type: "step", id: "contract", status: "skipped", note: "not a token" });
    s = applyStep(s, { type: "step", id: "contract", status: "running" });
    expect(s.find((x) => x.id === "contract")!.status).toBe("skipped");
  });

  it("a cached report finishes every server step except the roadmap", () => {
    let s = initialSteps();
    for (const e of allFromCache()) s = applyStep(s, e);
    expect(s.filter((x) => !isFinished(x.status)).map((x) => x.id)).toEqual(["roadmap"]);
    expect(s.find((x) => x.id === "market")!.note).toBe("cached");
  });

  it("plan-blocked and failed steps still count as finished", () => {
    expect(isFinished("blocked")).toBe(true);
    expect(isFinished("failed")).toBe(true);
    expect(isFinished("running")).toBe(false);
  });

  it("maps data sources to short notes", () => {
    expect(sourceNote("live")).toBe("live");
    expect(sourceNote("saved")).toBe("saved copy");
    expect(sourceNote(undefined)).toBeUndefined();
  });
});

describe("plan pill", () => {
  it("labels the 15,000-credit key as Basic and larger limits as paid", () => {
    expect(planSummary(15000, 14813)).toEqual({ label: "Basic plan", creditsLeft: 14813, limit: 15000, paid: false });
    expect(planSummary(300000, 299000).paid).toBe(true);
    expect(planSummary(null, null).label).toBe("Plan unknown");
  });
  it("compacts credit counts", () => {
    expect(compactCredits(14813)).toBe("14.8K");
    expect(compactCredits(950)).toBe("950");
    expect(compactCredits(1_200_000)).toBe("1.2M");
  });
});

describe("count-up numbers", () => {
  it("keeps prefix, decimals and suffix of the server's formatted value", () => {
    expect(parse("$26.2M")).toEqual({ pre: "$", n: 26.2, dec: 1, post: "M" });
    expect(parse("100%")).toEqual({ pre: "", n: 100, dec: 0, post: "%" });
    expect(parse("-20.2%")).toMatchObject({ n: -20.2, dec: 1 });
    expect(parse("1,234 markets")).toMatchObject({ n: 1234, post: " markets" });
  });
  it("leaves non-numbers alone", () => {
    expect(parse("Ethereum")).toBeNull();
  });
});

describe("navigation", () => {
  it("has the sidebar items in order, four of them in the phone bottom bar", () => {
    expect(NAV.map((n) => n.label)).toEqual(["Home", "Check a coin", "Watchlist", "Alerts", "Rescue", "Ask Covex", "Connect", "API evidence"]);
    expect(NAV.filter((n) => n.bottom)).toHaveLength(4);
  });
  it("highlights the right item for a path", () => {
    expect(activeNavId("/")).toBe("home");
    expect(activeNavId("/coin/24478")).toBe("check");
    expect(activeNavId("/rescue/24478")).toBe("rescue");
    expect(activeNavId("/alerts/abc")).toBe("alerts");
    expect(activeNavId("/design")).toBeNull();
  });
});

describe("motion tokens", () => {
  it("keeps tilt gentle and durations in the agreed scale", () => {
    expect(TILT_MAX_DEG).toBeLessThanOrEqual(4);
    expect([duration.fast, duration.base, duration.slow]).toEqual([0.15, 0.25, 0.4]);
  });
});
