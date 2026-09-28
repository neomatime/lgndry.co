import { beforeEach, describe, expect, it, vi } from "vitest";
import { sha256 } from "@/features/start-a-project/session-security";
import { PROJECT_TYPES } from "@/features/start-a-project/schemas";

const serviceRpc = vi.fn();
const createSignedUploadUrl = vi.fn();
const serviceInsert = vi.fn();
const verifyStoredObject = vi.fn();
const cleanupSessionObjects = vi.fn();
const serviceClient = {
  storage: { from: () => ({ createSignedUploadUrl }) },
  rpc: (...args: unknown[]) => serviceRpc(...args),
  from: (table: string) => ({ insert: (row: unknown) => serviceInsert(table, row) }),
};

vi.mock("@/lib/db/service", () => ({
  createSupabaseServiceClient: () => serviceClient,
}));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  }),
}));
vi.mock("@/lib/server-env", () => ({
  getServerEnv: () => ({
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    ENQUIRY_UPLOAD_RATE_LIMIT_SECRET: "r".repeat(32),
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-vercel-forwarded-for": "203.0.113.10" }),
}));
vi.mock("@/features/start-a-project/storage-verification", () => ({
  verifyStoredObject: (...args: unknown[]) => verifyStoredObject(...args),
  cleanupSessionObjects: (...args: unknown[]) => cleanupSessionObjects(...args),
}));

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

function baseFormData(over: Record<string, string> = {}) {
  const data = new FormData();
  const fields = {
    full_name: "Thandi Mokoena",
    company: "Blackridge Hotels",
    email: "thandi@example.com",
    phone: "0761234567",
    project_type: PROJECT_TYPES[0],
    location: "Polokwane",
    timeline: "Next 1-3 months",
    description: "A short documentary series.",
    budget: "R20,000 - R35,000",
    hp_website: "",
    ...over,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const SESSION_ID = "123e4567-e89b-42d3-a456-426614174000";
const ENQUIRY_ID = "123e4567-e89b-42d3-a456-426614174001";
const SESSION_SECRET = "s".repeat(43);
const MANIFEST_FILE = {
  storage_path: `${SESSION_ID}/0-brief.pdf`,
  file_name: "brief.pdf",
  mime_type: "application/pdf",
  size_bytes: PDF_BYTES.byteLength,
};
const SIGNED_UPLOAD_URL =
  `https://project.supabase.co/storage/v1/object/upload/sign/enquiry-attachments/` +
  `${SESSION_ID}/0-brief.pdf?token=signed-token`;

function sessionRow(
  over: Partial<{
    status: "pending" | "finalizing" | "completed" | "failed" | "expired";
    enquiry_id: string | null;
    expires_at: string;
    file_manifest: (typeof MANIFEST_FILE)[];
    client_secret_hash: string;
  }> = {},
) {
  return {
    id: SESSION_ID,
    client_secret_hash: sha256(SESSION_SECRET),
    status: "pending" as const,
    file_manifest: [MANIFEST_FILE],
    enquiry_id: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...over,
  };
}

beforeEach(() => {
  createSignedUploadUrl
    .mockReset()
    .mockResolvedValue({ data: { signedUrl: SIGNED_UPLOAD_URL }, error: null });
  serviceInsert.mockReset().mockResolvedValue({ error: null });
  verifyStoredObject.mockReset().mockResolvedValue({ ok: true });
  cleanupSessionObjects.mockReset().mockResolvedValue(true);
  serviceRpc.mockReset().mockImplementation(async (name: string) => {
    if (name === "get_enquiry_upload_session") {
      return { data: sessionRow(), error: null };
    }
    if (name === "finalize_enquiry_upload_session") {
      return {
        data: { enquiry_id: ENQUIRY_ID, created: true },
        error: null,
      };
    }
    if (name === "mark_enquiry_upload_session_failed") {
      return { data: true, error: null };
    }
    return { data: null, error: null };
  });
});

describe("prepareProjectEnquiry", () => {
  const descriptor = {
    fileName: "brief.pdf",
    sizeBytes: PDF_BYTES.byteLength,
    mimeType: "application/pdf",
  };

  it("creates a private session and returns path-specific signed upload URLs", async () => {
    const { prepareProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await prepareProjectEnquiry(baseFormData(), [descriptor]);

    expect(result).toMatchObject({
      status: "ready",
      sessionSecret: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      uploads: [
        expect.objectContaining({
          index: 0,
          fileName: "brief.pdf",
          mimeType: "application/pdf",
          uploadUrl: SIGNED_UPLOAD_URL,
        }),
      ],
    });
    expect(serviceRpc).toHaveBeenCalledWith(
      "create_enquiry_upload_session",
      expect.objectContaining({
        p_ip_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_client_secret_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_file_manifest: [
          expect.objectContaining({
            file_name: "brief.pdf",
            mime_type: "application/pdf",
            size_bytes: PDF_BYTES.byteLength,
          }),
        ],
      }),
    );
    expect(createSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]+\/0-brief\.pdf$/),
      { upsert: false },
    );
    expect(serviceRpc.mock.calls.flat(2).some((value) => value instanceof File)).toBe(false);
  });

  it("supports a zero-file session", async () => {
    const { prepareProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await prepareProjectEnquiry(baseFormData(), []);

    expect(result).toMatchObject({ status: "ready", uploads: [] });
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("validates descriptor metadata without creating a session", async () => {
    const { prepareProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await prepareProjectEnquiry(baseFormData(), [
      { ...descriptor, mimeType: "text/plain" },
    ]);

    expect(result).toMatchObject({ status: "error", code: "invalid" });
    expect(serviceRpc).not.toHaveBeenCalled();
  });

  it("returns a decoy acceptance for the honeypot", async () => {
    const { prepareProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await prepareProjectEnquiry(
      baseFormData({ hp_website: "https://spam.example" }),
      [descriptor],
    );

    expect(result).toEqual({ status: "accepted" });
    expect(serviceRpc).not.toHaveBeenCalled();
  });

  it("maps the database rate limit to visitor-safe copy", async () => {
    serviceRpc.mockResolvedValue({
      data: null,
      error: { message: "upload_rate_limit_exceeded" },
    });
    const { prepareProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await prepareProjectEnquiry(baseFormData(), [descriptor]);

    expect(result).toMatchObject({ status: "error", code: "rate-limited" });
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("marks a session failed when signed URL creation fails", async () => {
    createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: "storage unavailable" },
    });
    const { prepareProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await prepareProjectEnquiry(baseFormData(), [descriptor]);

    expect(result).toMatchObject({ status: "error", code: "failed" });
    expect(serviceRpc).toHaveBeenCalledWith(
      "mark_enquiry_upload_session_failed",
      expect.objectContaining({ p_session_id: expect.any(String) }),
    );
  });
});

describe("finalizeProjectEnquiry", () => {
  it("verifies Storage, finalizes once, and links the activity row", async () => {
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, SESSION_SECRET);

    expect(result).toEqual({ status: "complete" });
    expect(verifyStoredObject).toHaveBeenCalledWith(
      serviceClient,
      MANIFEST_FILE,
      expect.objectContaining({
        supabaseUrl: "https://project.supabase.co",
        serviceRoleKey: "service-key",
      }),
    );
    expect(serviceRpc).toHaveBeenCalledWith(
      "finalize_enquiry_upload_session",
      expect.objectContaining({
        p_full_name: "Thandi Mokoena",
        p_session_id: SESSION_ID,
      }),
    );
    expect(serviceInsert).toHaveBeenCalledWith(
      "ops_activity_log",
      expect.objectContaining({
        collection: "enquiries",
        record_id: ENQUIRY_ID,
      }),
    );
    expect(serviceRpc.mock.calls.flat(2).some((value) => value instanceof File)).toBe(false);
  });

  it("rejects the wrong capability without reading Storage", async () => {
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, "x".repeat(43));

    expect(result).toMatchObject({ status: "error", code: "invalid" });
    expect(verifyStoredObject).not.toHaveBeenCalled();
  });

  it("reports an expired session without finalizing", async () => {
    serviceRpc.mockImplementation(async (name: string) => {
      if (name === "get_enquiry_upload_session") {
        return {
          data: sessionRow({ expires_at: new Date(Date.now() - 60_000).toISOString() }),
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, SESSION_SECRET);

    expect(result).toMatchObject({ status: "error", code: "expired" });
    expect(verifyStoredObject).not.toHaveBeenCalled();
  });

  it("fails and cleans the session when an object is invalid", async () => {
    verifyStoredObject.mockResolvedValue({ ok: false, reason: "content" });
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, SESSION_SECRET);

    expect(result).toMatchObject({ status: "error", code: "invalid" });
    expect(serviceRpc).toHaveBeenCalledWith("mark_enquiry_upload_session_failed", {
      p_session_id: SESSION_ID,
    });
    expect(cleanupSessionObjects).toHaveBeenCalledWith(serviceClient, [MANIFEST_FILE]);
    expect(serviceRpc).not.toHaveBeenCalledWith(
      "finalize_enquiry_upload_session",
      expect.anything(),
    );
  });

  it("preserves uploads when Storage verification is temporarily unavailable", async () => {
    verifyStoredObject.mockResolvedValue({ ok: false, reason: "unavailable" });
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, SESSION_SECRET);

    expect(result).toMatchObject({ status: "error", code: "failed" });
    expect(cleanupSessionObjects).not.toHaveBeenCalled();
    expect(serviceRpc).not.toHaveBeenCalledWith(
      "mark_enquiry_upload_session_failed",
      expect.anything(),
    );
  });

  it("recognizes a committed session after an ambiguous RPC response", async () => {
    let sessionRead = 0;
    serviceRpc.mockImplementation(async (name: string) => {
      if (name === "get_enquiry_upload_session") {
        sessionRead += 1;
        return {
          data:
            sessionRead === 1
              ? sessionRow()
              : sessionRow({ status: "completed", enquiry_id: ENQUIRY_ID }),
          error: null,
        };
      }
      if (name === "finalize_enquiry_upload_session") {
        return { data: null, error: { message: "network response lost" } };
      }
      return { data: null, error: null };
    });
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, SESSION_SECRET);

    expect(result).toEqual({ status: "complete" });
    expect(cleanupSessionObjects).not.toHaveBeenCalled();
  });

  it("preserves uploads when an ambiguous finalizer response cannot be rechecked", async () => {
    let sessionRead = 0;
    serviceRpc.mockImplementation(async (name: string) => {
      if (name === "get_enquiry_upload_session") {
        sessionRead += 1;
        return sessionRead === 1
          ? { data: sessionRow(), error: null }
          : { data: null, error: { message: "network unavailable" } };
      }
      if (name === "finalize_enquiry_upload_session") {
        return { data: null, error: { message: "network response lost" } };
      }
      return { data: null, error: null };
    });
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, SESSION_SECRET);

    expect(result).toMatchObject({ status: "error", code: "failed" });
    expect(cleanupSessionObjects).not.toHaveBeenCalled();
  });

  it("returns an already-completed session without duplicate work", async () => {
    serviceRpc.mockImplementation(async (name: string) => ({
      data:
        name === "get_enquiry_upload_session"
          ? sessionRow({ status: "completed", enquiry_id: ENQUIRY_ID })
          : null,
      error: null,
    }));
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, SESSION_SECRET);

    expect(result).toEqual({ status: "complete" });
    expect(verifyStoredObject).not.toHaveBeenCalled();
    expect(serviceInsert).not.toHaveBeenCalled();
  });

  it("does not duplicate activity for a concurrent finalizer", async () => {
    serviceRpc.mockImplementation(async (name: string) => {
      if (name === "get_enquiry_upload_session") {
        return { data: sessionRow(), error: null };
      }
      if (name === "finalize_enquiry_upload_session") {
        return { data: { enquiry_id: ENQUIRY_ID, created: false }, error: null };
      }
      return { data: null, error: null };
    });
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, SESSION_SECRET);

    expect(result).toEqual({ status: "complete" });
    expect(serviceInsert).not.toHaveBeenCalled();
  });

  it("cleans uploaded objects after a confirmed finalizer failure", async () => {
    serviceRpc.mockImplementation(async (name: string) => {
      if (name === "get_enquiry_upload_session") {
        return { data: sessionRow(), error: null };
      }
      if (name === "finalize_enquiry_upload_session") {
        return { data: null, error: { message: "constraint violation" } };
      }
      if (name === "mark_enquiry_upload_session_failed") {
        return { data: true, error: null };
      }
      return { data: null, error: null };
    });
    const { finalizeProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await finalizeProjectEnquiry(baseFormData(), SESSION_ID, SESSION_SECRET);

    expect(result).toMatchObject({ status: "error", code: "failed" });
    expect(cleanupSessionObjects).toHaveBeenCalledWith(serviceClient, [MANIFEST_FILE]);
  });
});
