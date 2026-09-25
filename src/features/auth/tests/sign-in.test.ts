import { describe, expect, it } from "vitest";
import { safeNextPath, signInSchema } from "@/features/auth/schemas/sign-in";

describe("safeNextPath", () => {
  it("defaults to the OPS home when nothing is given", () => {
    expect(safeNextPath(undefined)).toBe("/ops");
    expect(safeNextPath(null)).toBe("/ops");
    expect(safeNextPath("")).toBe("/ops");
  });

  it("keeps in-app OPS destinations, including query and hash", () => {
    expect(safeNextPath("/ops")).toBe("/ops");
    expect(safeNextPath("/ops/projects")).toBe("/ops/projects");
    expect(safeNextPath("/ops/projects?stage=review")).toBe("/ops/projects?stage=review");
    expect(safeNextPath("/ops/clients#notes")).toBe("/ops/clients#notes");
  });

  it.each([
    "https://evil.example/ops",
    "//evil.example",
    "/\\evil.example",
    "/ops\\..\\evil",
    "/opsevil",
    "/auth/login",
    "/",
    "javascript:alert(1)",
  ])("rejects %s", (value) => {
    expect(safeNextPath(value)).toBe("/ops");
  });
});

describe("signInSchema", () => {
  it("accepts an email and password and trims the email", () => {
    const parsed = signInSchema.parse({ email: "  dan@lgndry-co.co.za ", password: "x" });
    expect(parsed.email).toBe("dan@lgndry-co.co.za");
  });

  it("rejects a malformed email or an empty password", () => {
    expect(signInSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "dan@lgndry-co.co.za", password: "" }).success).toBe(
      false,
    );
  });
});
