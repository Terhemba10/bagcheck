import { describe, expect, it } from "vitest";
import { checkUrlShape, isPrivateIp, UnsafeUrlError } from "@/lib/net/safeFetch";
import { classifyStatus } from "@/lib/core/links";

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "104.16.1.1", "172.32.0.1", "2606:4700::1111"])("allows %s", (ip) => expect(isPrivateIp(ip)).toBe(false));
});

describe("checkUrlShape", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com",
    "http://localhost:3000",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data",
    "https://example.com:8443/",
    "https://user:pass@example.com/",
    "http://printer.local/",
    "not a url",
  ])("refuses %s", (u) => expect(() => checkUrlShape(u)).toThrow(UnsafeUrlError));
  it("accepts normal public links", () => {
    expect(checkUrlShape("https://www.pepe.vip/").hostname).toBe("www.pepe.vip");
  });
});

describe("link status", () => {
  it("treats bot-blocking responses as reachable", () => {
    expect(classifyStatus(200)).toBe("up");
    expect(classifyStatus(301)).toBe("up");
    expect(classifyStatus(403)).toBe("blocked");
    expect(classifyStatus(404)).toBe("down");
    expect(classifyStatus(503)).toBe("down");
  });
});
