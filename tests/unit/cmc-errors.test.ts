import { describe, expect, it } from "vitest";
import { classifyCmcResponse } from "@/lib/cmc/errors";

describe("classifyCmcResponse", () => {
  it("returns null for a normal success (v1/v2 numeric code 0)", () => {
    expect(classifyCmcResponse(200, { error_code: 0, error_message: null })).toBeNull();
  });

  it("returns null for a v3 success (string code \"0\")", () => {
    expect(classifyCmcResponse(200, { error_code: "0", error_message: "" })).toBeNull();
  });

  it("detects plan blocks (1006)", () => {
    expect(classifyCmcResponse(403, { error_code: 1006, error_message: "Your API Key subscription plan doesn't support this endpoint." })?.kind).toBe("plan_blocked");
  });

  it("detects plan blocks from a 403 message without a code", () => {
    expect(classifyCmcResponse(403, { error_message: "Not authorized for your plan" })?.kind).toBe("plan_blocked");
  });

  it.each([
    [1008, "rate_limited"],
    [1011, "rate_limited"],
    [1009, "credits_exhausted"],
    [1010, "credits_exhausted"],
    [1001, "auth"],
    [1002, "auth"],
    [1004, "subscription"],
  ] as const)("maps code %i to %s", (code, kind) => {
    expect(classifyCmcResponse(code === 1001 || code === 1002 ? 401 : 429, { error_code: code })?.kind).toBe(kind);
  });

  it("treats bare 429 as rate limited and 5xx as upstream", () => {
    expect(classifyCmcResponse(429, undefined)?.kind).toBe("rate_limited");
    expect(classifyCmcResponse(503, undefined)?.kind).toBe("upstream");
  });

  it("flags a 200 that carries a non-zero error code", () => {
    expect(classifyCmcResponse(200, { error_code: 1006 })?.kind).toBe("plan_blocked");
  });
});
