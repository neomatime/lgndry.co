import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createSessionSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashRequestAddress(address: string, secret: string): string {
  return createHmac("sha256", secret).update(address, "utf8").digest("hex");
}

export function secretsMatch(candidate: string, expectedHash: string): boolean {
  const candidateHash = Buffer.from(sha256(candidate), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return candidateHash.length === expected.length && timingSafeEqual(candidateHash, expected);
}

export function requestAddress(requestHeaders: Headers): string {
  const forwarded =
    requestHeaders.get("x-vercel-forwarded-for") ?? requestHeaders.get("x-forwarded-for");
  const firstAddress = forwarded?.split(",", 1)[0]?.trim();
  return firstAddress || "local-development";
}
