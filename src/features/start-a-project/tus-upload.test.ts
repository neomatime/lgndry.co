import { beforeEach, describe, expect, it, vi } from "vitest";

const tus = vi.hoisted(() => ({
  constructor: vi.fn(),
  findPreviousUploads: vi.fn<() => Promise<unknown[]>>(),
  resumeFromPreviousUpload: vi.fn(),
  start: vi.fn(),
  abort: vi.fn<() => Promise<void>>(),
}));

vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(file: File, options: unknown) {
      tus.constructor(file, options);
    }

    findPreviousUploads = tus.findPreviousUploads;
    resumeFromPreviousUpload = tus.resumeFromPreviousUpload;
    start = tus.start;
    abort = tus.abort;
  },
}));

import { startTusUpload } from "./tus-upload";

type CapturedOptions = {
  endpoint: string;
  chunkSize: number;
  retryDelays: number[];
  uploadDataDuringCreation: boolean;
  removeFingerprintOnSuccess: boolean;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  onProgress: (bytesSent: number, bytesTotal: number) => void;
  onSuccess: () => void;
  onError: (error: Error) => void;
};

function capturedOptions(): CapturedOptions {
  return tus.constructor.mock.calls[0]?.[1] as CapturedOptions;
}

describe("startTusUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tus.findPreviousUploads.mockResolvedValue([]);
    tus.abort.mockResolvedValue();
  });

  it("configures a signed, resumable direct upload", async () => {
    const file = new File(["brief"], "brief.pdf", { type: "application/pdf" });
    const onProgress = vi.fn();
    const handle = startTusUpload({
      file,
      endpoint: "https://abc.storage.supabase.co/storage/v1/upload/resumable",
      token: "signed-token",
      storagePath: "session/0-brief.pdf",
      mimeType: "application/pdf",
      onProgress,
    });

    await vi.waitFor(() => expect(tus.start).toHaveBeenCalledOnce());
    expect(tus.constructor).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        endpoint: "https://abc.storage.supabase.co/storage/v1/upload/resumable",
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: { "x-signature": "signed-token" },
        metadata: {
          bucketName: "enquiry-attachments",
          objectName: "session/0-brief.pdf",
          contentType: "application/pdf",
          cacheControl: "3600",
        },
      }),
    );

    capturedOptions().onProgress(3, 4);
    expect(onProgress).toHaveBeenCalledWith(75);
    capturedOptions().onSuccess();
    await expect(handle.done).resolves.toBeUndefined();
  });

  it("resumes the first matching upload", async () => {
    const previous = { uploadUrl: "https://upload.example/resume" };
    tus.findPreviousUploads.mockResolvedValue([previous]);

    const handle = startTusUpload({
      file: new File(["brief"], "brief.pdf"),
      endpoint: "https://abc.storage.supabase.co/storage/v1/upload/resumable",
      token: "signed-token",
      storagePath: "session/0-brief.pdf",
      mimeType: "application/pdf",
      onProgress: vi.fn(),
    });

    await vi.waitFor(() => expect(tus.start).toHaveBeenCalledOnce());
    expect(tus.resumeFromPreviousUpload).toHaveBeenCalledWith(previous);
    capturedOptions().onSuccess();
    await handle.done;
  });

  it("rejects once on upload failure and exposes cancellation", async () => {
    const handle = startTusUpload({
      file: new File(["brief"], "brief.pdf"),
      endpoint: "https://abc.storage.supabase.co/storage/v1/upload/resumable",
      token: "signed-token",
      storagePath: "session/0-brief.pdf",
      mimeType: "application/pdf",
      onProgress: vi.fn(),
    });
    await vi.waitFor(() => expect(tus.start).toHaveBeenCalledOnce());

    const failure = new Error("connection lost");
    capturedOptions().onError(failure);
    capturedOptions().onError(new Error("second error"));
    await expect(handle.done).rejects.toBe(failure);

    await handle.abort();
    expect(tus.abort).toHaveBeenCalledWith(false);
  });
});
