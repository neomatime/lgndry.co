import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ kind: "service-client" })),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
  }),
}));
vi.mock("@/lib/server-env", () => ({
  getServerEnv: () => ({
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: "x".repeat(32),
  }),
}));

import { createSupabaseServiceClient } from "@/lib/db/service";

describe("createSupabaseServiceClient", () => {
  beforeEach(() => createClientMock.mockClear());

  it("creates a server-only client without persisted auth state", () => {
    expect(createSupabaseServiceClient()).toEqual({ kind: "service-client" });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-role-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  });
});
