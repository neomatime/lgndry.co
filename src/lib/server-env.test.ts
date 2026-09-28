import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/server-env";

describe("parseServerEnv", () => {
  it("accepts both high-entropy server values", () => {
    expect(
      parseServerEnv({
        SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
        ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: "x".repeat(32),
      }),
    ).toEqual({
      SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
      ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: "x".repeat(32),
    });
  });

  it("names a missing service-role key", () => {
    expect(() => parseServerEnv({ ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: "x".repeat(32) })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("names a missing or weak rate-limit secret", () => {
    expect(() =>
      parseServerEnv({
        SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
        ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: "short",
      }),
    ).toThrow(/ENQUIRY_UPLOAD_RATE_LIMIT_SECRET/);
  });
});
