import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupSessionObjects, verifyStoredObject } from "./storage-verification";
import type { UploadedFile } from "./records";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0]);
const info = vi.fn();
const remove = vi.fn();
const client = { storage: { from: vi.fn(() => ({ info, remove })) } };

function partialResponse(body: Uint8Array) {
  return new Response(body.buffer as ArrayBuffer, {
    status: 206,
    headers: {
      "content-length": String(body.byteLength),
      "content-range": `bytes 0-${body.byteLength - 1}/${body.byteLength}`,
    },
  });
}

const file: UploadedFile = {
  storage_path: "session id/0-brief (final).pdf",
  file_name: "brief (final).pdf",
  mime_type: "application/pdf",
  size_bytes: 8,
};

function options(fetchImpl: typeof fetch) {
  return {
    supabaseUrl: "https://project.supabase.co",
    serviceRoleKey: "service-key",
    fetchImpl,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  info.mockResolvedValue({
    data: { size: 8, contentType: "application/pdf" },
    error: null,
  });
  remove.mockResolvedValue({ data: [], error: null });
});

describe("verifyStoredObject", () => {
  it("checks metadata and only requests the signature prefix", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(partialResponse(PDF));

    await expect(verifyStoredObject(client, file, options(fetchImpl))).resolves.toEqual({
      ok: true,
    });
    expect(client.storage.from).toHaveBeenCalledWith("enquiry-attachments");
    expect(info).toHaveBeenCalledWith(file.storage_path);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1/object/authenticated/enquiry-attachments/session%20id/0-brief%20(final).pdf",
      {
        headers: {
          apikey: "service-key",
          Authorization: "Bearer service-key",
          Range: "bytes=0-15",
        },
      },
    );
  });

  it("rejects a missing object before fetching bytes", async () => {
    info.mockResolvedValue({ data: null, error: null });
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(verifyStoredObject(client, file, options(fetchImpl))).resolves.toEqual({
      ok: false,
      reason: "missing",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("treats an object-info error as retryable unavailability", async () => {
    info.mockResolvedValue({ data: null, error: { message: "storage unavailable" } });

    await expect(verifyStoredObject(client, file, options(vi.fn<typeof fetch>()))).resolves.toEqual(
      { ok: false, reason: "unavailable" },
    );
  });

  it("rejects size and MIME mismatches before fetching bytes", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    info.mockResolvedValueOnce({ data: { size: 9, contentType: "application/pdf" }, error: null });
    await expect(verifyStoredObject(client, file, options(fetchImpl))).resolves.toMatchObject({
      reason: "size",
    });

    info.mockResolvedValueOnce({ data: { size: 8, contentType: "text/plain" }, error: null });
    await expect(verifyStoredObject(client, file, options(fetchImpl))).resolves.toMatchObject({
      reason: "mime",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature and an unavailable byte read", async () => {
    const badContent = vi.fn<typeof fetch>().mockResolvedValue(partialResponse(EXE));
    await expect(verifyStoredObject(client, file, options(badContent))).resolves.toMatchObject({
      reason: "content",
    });

    const unavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(verifyStoredObject(client, file, options(unavailable))).resolves.toMatchObject({
      reason: "unavailable",
    });
  });

  it("refuses to buffer a response when Storage ignores or exceeds the byte range", async () => {
    const ignoredRange = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(PDF, { status: 200 }));
    await expect(verifyStoredObject(client, file, options(ignoredRange))).resolves.toMatchObject({
      reason: "unavailable",
    });

    const oversizedRange = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(PDF, {
        status: 206,
        headers: { "content-length": "32", "content-range": "bytes 0-31/100" },
      }),
    );
    await expect(verifyStoredObject(client, file, options(oversizedRange))).resolves.toMatchObject({
      reason: "unavailable",
    });
  });
});

describe("cleanupSessionObjects", () => {
  it("removes only paths from the stored manifest", async () => {
    await expect(cleanupSessionObjects(client, [file])).resolves.toBe(true);
    expect(remove).toHaveBeenCalledWith([file.storage_path]);
  });

  it("does not call Storage for an empty manifest", async () => {
    await expect(cleanupSessionObjects(client, [])).resolves.toBe(true);
    expect(remove).not.toHaveBeenCalled();
  });

  it("reports cleanup errors", async () => {
    remove.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(cleanupSessionObjects(client, [file])).resolves.toBe(false);
  });
});
