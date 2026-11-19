import { describe, expect, it } from "vitest";
import { AGENT_LOOKS, heartbeat } from "@/components/agent/states";
import { pickQuality, shouldDowngrade } from "@/components/agent/quality";

describe("heartbeat", () => {
  it("stays within 0..1 and repeats every period", () => {
    for (let t = 0; t < 5; t += 0.01) {
      const v = heartbeat(t, 1.6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(heartbeat(t + 1.6, 1.6)).toBeCloseTo(v, 6);
    }
  });
  it("has a lub-dub shape: a big beat, a smaller beat, then rest", () => {
    const p = 2;
    const lub = heartbeat(0.08 * p, p);
    const dub = heartbeat(0.24 * p, p);
    const rest = heartbeat(0.7 * p, p);
    expect(lub).toBeGreaterThan(dub);
    expect(dub).toBeGreaterThan(0.4);
    expect(rest).toBeLessThan(0.01);
  });
});

describe("agent looks", () => {
  it("danger never shakes: no lean or sway, slow deep pulse and a shield instead", () => {
    const d = AGENT_LOOKS.danger;
    expect(d.lean).toBe(0);
    expect("sway" in d).toBe(false);
    expect(d.shield).toBe(true);
    expect(d.heartbeat).toBeGreaterThanOrEqual(2);
  });
});

describe("quality", () => {
  it("defaults to high at 30 fps", () => {
    expect(pickQuality("", null)).toEqual({ quality: "high", fpsCap: 30, forced: false });
  });
  it("remembers a downgrade for the session", () => {
    expect(pickQuality("", "low").quality).toBe("low");
  });
  it("accepts URL overrides for measuring", () => {
    expect(pickQuality("?quality=low&fps=60", null)).toEqual({ quality: "low", fpsCap: 60, forced: true });
    expect(pickQuality("?fps=999", null).fpsCap).toBe(30);
  });
  it("downgrades only when High can't hold 80% of the cap, and never back up", () => {
    expect(shouldDowngrade("high", 29.5, 30)).toBe(false);
    expect(shouldDowngrade("high", 21, 30)).toBe(true);
    expect(shouldDowngrade("low", 5, 30)).toBe(false);
  });
});
