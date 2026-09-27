import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_TYPES } from "@/features/start-a-project/schemas";

const rpc = vi.fn();
const upload = vi.fn();
const insert = vi.fn();
const anonClient = {
  storage: { from: () => ({ upload }) },
  rpc: (...args: unknown[]) => rpc(...args),
  from: (table: string) => ({ insert: (row: unknown) => insert(table, row) }),
};
vi.mock("@/lib/db/anon", () => ({ createSupabaseAnonClient: () => anonClient }));

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

function pdfFile(name = "brief.pdf", bytes = PDF_BYTES) {
  return new File([bytes], name, { type: "application/pdf" });
}

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

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: "new-id", error: null });
  upload.mockReset().mockResolvedValue({ data: { path: "x" }, error: null });
  insert.mockReset().mockResolvedValue({ error: null });
});

describe("submitProjectEnquiry", () => {
  it("uploads each attachment, then calls submit_enquiry, then logs activity", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    formData.append("attachments", pdfFile());

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: true });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[0]).toMatch(/^[0-9a-f-]+\/0-brief\.pdf$/);
    expect(rpc).toHaveBeenCalledWith(
      "submit_enquiry",
      expect.objectContaining({
        full_name: "Thandi Mokoena",
        attachments: [
          expect.objectContaining({ file_name: "brief.pdf", mime_type: "application/pdf" }),
        ],
      }),
    );
    expect(insert).toHaveBeenCalledWith(
      "ops_activity_log",
      expect.objectContaining({ message: expect.stringContaining("Thandi Mokoena") }),
    );
  });

  it("succeeds with no attachments at all", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const result = await submitProjectEnquiry(baseFormData());

    expect(result).toEqual({ ok: true });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "submit_enquiry",
      expect.objectContaining({ attachments: [] }),
    );
  });

  it("rejects invalid form fields without touching the database", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const result = await submitProjectEnquiry(baseFormData({ email: "not-an-email" }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("pretends to succeed for a honeypot hit, storing nothing", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const result = await submitProjectEnquiry(baseFormData({ hp_website: "http://spam.example" }));

    expect(result).toEqual({ ok: true });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects too many files without uploading any of them", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    for (let i = 0; i < 6; i++) formData.append("attachments", pdfFile(`brief-${i}.pdf`));

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("5 files") });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before uploading anything", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    formData.append("attachments", pdfFile("huge.pdf", new Uint8Array(15 * 1024 * 1024 + 1)));

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("15 MB") });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a disallowed extension before uploading anything", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    formData.append(
      "attachments",
      new File([PDF_BYTES], "script.exe", { type: "application/octet-stream" }),
    );

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("script.exe") });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file whose real bytes don't match its claimed type, before uploading anything", async () => {
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    const fakeExe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0]); // "MZ"
    formData.append("attachments", pdfFile("invoice.pdf", fakeExe));

    const result = await submitProjectEnquiry(formData);

    expect(result.ok).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it("fails cleanly when an upload fails", async () => {
    upload.mockResolvedValue({ data: null, error: { message: "storage down" } });
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");
    const formData = baseFormData();
    formData.append("attachments", pdfFile());

    const result = await submitProjectEnquiry(formData);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails cleanly when submit_enquiry fails, without failing on the activity log", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "constraint violation" } });
    const { submitProjectEnquiry } = await import("@/features/start-a-project/actions");

    const result = await submitProjectEnquiry(baseFormData());

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
  });
});
