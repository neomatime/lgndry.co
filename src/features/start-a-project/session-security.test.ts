import { describe, expect, it } from "vitest";
import {
  createSessionSecret,
  hashRequestAddress,
  requestAddress,
  secretsMatch,
  sha256,
} from "./session-security";

describe("upload session security", () => {
  it("creates a high-entropy URL-safe capability", () => {
    const first = createSessionSecret();
    const second = createSessionSecret();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("hashes capabilities and compares them safely", () => {
    const secret = "a".repeat(43);
    const hash = sha256(secret);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(secretsMatch(secret, hash)).toBe(true);
    expect(secretsMatch("b".repeat(43), hash)).toBe(false);
    expect(secretsMatch(secret, "bad-hash")).toBe(false);
  });

  it("creates stable keyed address hashes without storing the address", () => {
    const first = hashRequestAddress("203.0.113.10", "x".repeat(32));

    expect(first).toHaveLength(64);
    expect(first).not.toContain("203.0.113.10");
    expect(hashRequestAddress("203.0.113.10", "x".repeat(32))).toBe(first);
    expect(hashRequestAddress("203.0.113.11", "x".repeat(32))).not.toBe(first);
  });

  it("prefers Vercel's protected forwarded address", () => {
    const requestHeaders = new Headers({
      "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-forwarded-for": "198.51.100.2",
    });

    expect(requestAddress(requestHeaders)).toBe("203.0.113.10");
  });

  it("falls back through the ordinary proxy header to local development", () => {
    expect(requestAddress(new Headers({ "x-forwarded-for": "198.51.100.2, 10.0.0.2" }))).toBe(
      "198.51.100.2",
    );
    expect(requestAddress(new Headers())).toBe("local-development");
  });
});
