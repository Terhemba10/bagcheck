import { describe, expect, it } from "vitest";
import { chooseGraphics } from "@/components/agent/graphics";

const capable = { reducedMotion: false, webgl: true, deviceMemory: 8, cores: 4, userPrefersSimple: false };

describe("chooseGraphics", () => {
  it("uses 3D on a normal laptop (8 GB, 4 cores)", () => {
    expect(chooseGraphics(capable).mode).toBe("3d");
  });
  it.each([
    ["reduced motion", { reducedMotion: true }],
    ["no WebGL", { webgl: false }],
    ["low memory", { deviceMemory: 2 }],
    ["two cores", { cores: 2 }],
    ["user toggle", { userPrefersSimple: true }],
    ["data saver", { saveData: true }],
  ])("falls back to 2D for %s", (_n, override) => {
    expect(chooseGraphics({ ...capable, ...override }).mode).toBe("2d");
  });
  it("treats unknown memory/cores as capable", () => {
    expect(chooseGraphics({ reducedMotion: false, webgl: true, userPrefersSimple: false }).mode).toBe("3d");
  });
});
