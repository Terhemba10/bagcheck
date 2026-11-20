import { describe, expect, it } from "vitest";
import { chooseGraphics } from "@/lib/client/graphics";

const capable = { reducedMotion: false, deviceMemory: 8, cores: 4, userPrefersSimple: false };

describe("chooseGraphics", () => {
  it("uses full graphics on a normal laptop (8 GB, 4 cores)", () => {
    expect(chooseGraphics(capable).mode).toBe("full");
  });
  it.each([
    ["reduced motion", { reducedMotion: true }],
    ["low memory", { deviceMemory: 2 }],
    ["two cores", { cores: 2 }],
    ["user toggle", { userPrefersSimple: true }],
    ["data saver", { saveData: true }],
  ])("falls back to simple graphics for %s", (_n, override) => {
    expect(chooseGraphics({ ...capable, ...override }).mode).toBe("simple");
  });
  it("treats unknown memory/cores as capable", () => {
    expect(chooseGraphics({ reducedMotion: false, userPrefersSimple: false }).mode).toBe("full");
  });
  it("the user's choice wins and is explained", () => {
    expect(chooseGraphics({ ...capable, userPrefersSimple: true }).reason).toMatch(/You chose/);
  });
});
