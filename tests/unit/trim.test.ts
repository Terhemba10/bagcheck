import { describe, expect, it } from "vitest";
import { redactKey, trimJson } from "@/lib/cmc/trim";

describe("trimJson", () => {
  it("cuts arrays and notes how many were dropped", () => {
    expect(trimJson([1, 2, 3, 4, 5])).toEqual([1, 2, 3, "… 2 more items"]);
  });
  it("redacts secret-looking keys", () => {
    expect(trimJson({ api_key: "x", token: "y", price: 1 })).toEqual({ api_key: "[redacted]", token: "[redacted]", price: 1 });
  });
  it("shortens long strings", () => {
    const out = trimJson("a".repeat(500)) as string;
    expect(out.length).toBeLessThan(200);
    expect(out).toContain("500 chars");
  });
});

describe("redactKey", () => {
  it("removes the key from text", () => {
    expect(redactKey("url?k=SECRET&x=1", "SECRET")).toBe("url?k=[CMC_API_KEY]&x=1");
  });
});
