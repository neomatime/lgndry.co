import { beforeEach, describe, expect, it, vi } from "vitest";
import { startSignedUpload } from "./signed-upload";

type Listener = () => void;
type ProgressListener = (event: ProgressEvent) => void;

class FakeXMLHttpRequest {
  static instances: FakeXMLHttpRequest[] = [];

  status = 0;
  method = "";
  url = "";
  body: Document | XMLHttpRequestBodyInit | null = null;
  headers = new Map<string, string>();
  listeners = new Map<string, Listener>();
  progressListener: ProgressListener | null = null;
  nativeAbort = vi.fn(() => this.emit("abort"));
  upload = {
    addEventListener: vi.fn((event: string, listener: ProgressListener) => {
      if (event === "progress") this.progressListener = listener;
    }),
  };

  constructor() {
    FakeXMLHttpRequest.instances.push(this);
  }

  addEventListener(event: string, listener: Listener) {
    this.listeners.set(event, listener);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  send(body: Document | XMLHttpRequestBodyInit | null) {
    this.body = body;
  }

  abort() {
    this.nativeAbort();
  }

  emit(event: string) {
    this.listeners.get(event)?.();
  }

  emitProgress(loaded: number, total: number) {
    this.progressListener?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }
}

function request() {
  return FakeXMLHttpRequest.instances[0]!;
}

describe("startSignedUpload", () => {
  beforeEach(() => {
    FakeXMLHttpRequest.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
  });

  it("uploads the file directly with the exact signed URL and reports progress", async () => {
    const file = new File(["brief"], "brief.pdf", { type: "application/pdf" });
    const onProgress = vi.fn();
    const handle = startSignedUpload({
      file,
      uploadUrl:
        "https://abc.supabase.co/storage/v1/object/upload/sign/enquiry-attachments/session/0-brief.pdf?token=signed",
      onProgress,
    });

    expect(request().method).toBe("PUT");
    expect(request().url).toContain("/object/upload/sign/enquiry-attachments/");
    expect(request().headers.get("x-upsert")).toBe("false");
    expect(request().body).toBeInstanceOf(FormData);
    expect((request().body as FormData).get("cacheControl")).toBe("3600");
    expect((request().body as FormData).get("")).toBe(file);

    request().emitProgress(3, 4);
    expect(onProgress).toHaveBeenCalledWith(75);
    request().status = 200;
    request().emit("load");
    await expect(handle.done).resolves.toBeUndefined();
  });

  it("rejects unsuccessful responses", async () => {
    const handle = startSignedUpload({
      file: new File(["brief"], "brief.pdf"),
      uploadUrl: "https://abc.supabase.co/signed",
      onProgress: vi.fn(),
    });

    request().status = 400;
    request().emit("load");
    await expect(handle.done).rejects.toThrow("Upload failed.");
  });

  it("cancels an active request", async () => {
    const handle = startSignedUpload({
      file: new File(["brief"], "brief.pdf"),
      uploadUrl: "https://abc.supabase.co/signed",
      onProgress: vi.fn(),
    });

    await handle.abort();
    expect(request().nativeAbort).toHaveBeenCalledOnce();
    await expect(handle.done).rejects.toThrow("Upload cancelled.");
  });
});
