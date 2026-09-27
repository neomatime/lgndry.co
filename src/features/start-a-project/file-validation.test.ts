import { describe, expect, it } from "vitest";
import {
  MAX_FILES,
  canonicalMimeType,
  checkFileContent,
  checkFileCount,
  checkFileMeta,
  extensionOf,
  sanitizeFileName,
} from "@/features/start-a-project/file-validation";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // legacy .doc / .xls
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]); // .docx / .xlsx
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0]); // "MZ" (Windows executable)

describe("extensionOf", () => {
  it("reads the lower-cased extension", () => {
    expect(extensionOf("Brief.PDF")).toBe("pdf");
    expect(extensionOf("photo.jpeg")).toBe("jpeg");
  });

  it("is empty for a file with no extension", () => {
    expect(extensionOf("README")).toBe("");
  });
});

describe("checkFileMeta", () => {
  it("accepts an allowed extension within the size limit", () => {
    expect(checkFileMeta("brief.pdf", 1024)).toEqual({ ok: true });
  });

  it("rejects a disallowed extension", () => {
    const result = checkFileMeta("script.exe", 1024);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("script.exe") });
  });

  it("rejects a file over 15 MB", () => {
    const result = checkFileMeta("brief.pdf", 15 * 1024 * 1024 + 1);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("15 MB") });
  });

  it("rejects an empty file", () => {
    expect(checkFileMeta("brief.pdf", 0).ok).toBe(false);
  });

  it("accepts every allowed extension", () => {
    for (const extension of ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"]) {
      expect(checkFileMeta(`file.${extension}`, 1024)).toEqual({ ok: true });
    }
  });
});

describe("checkFileContent", () => {
  it("accepts a file whose bytes match its extension", () => {
    expect(checkFileContent("brief.pdf", PDF)).toEqual({ ok: true });
    expect(checkFileContent("photo.jpg", JPEG)).toEqual({ ok: true });
    expect(checkFileContent("photo.png", PNG)).toEqual({ ok: true });
    expect(checkFileContent("old.doc", OLE)).toEqual({ ok: true });
    expect(checkFileContent("old.xls", OLE)).toEqual({ ok: true });
    expect(checkFileContent("new.docx", ZIP)).toEqual({ ok: true });
    expect(checkFileContent("new.xlsx", ZIP)).toEqual({ ok: true });
  });

  it("rejects a disguised executable claiming to be a PDF", () => {
    const result = checkFileContent("invoice.pdf", EXE);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("invoice.pdf") });
  });

  it("rejects a JPEG renamed to .png", () => {
    expect(checkFileContent("photo.png", JPEG).ok).toBe(false);
  });

  it("rejects an unsupported extension outright", () => {
    expect(checkFileContent("script.exe", EXE).ok).toBe(false);
  });
});

describe("checkFileCount", () => {
  it(`allows up to ${MAX_FILES} files`, () => {
    expect(checkFileCount(MAX_FILES)).toEqual({ ok: true });
  });

  it(`rejects more than ${MAX_FILES} files`, () => {
    const result = checkFileCount(MAX_FILES + 1);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining(String(MAX_FILES)) });
  });
});

describe("canonicalMimeType", () => {
  it("maps every allowed extension to its bucket-matching canonical MIME type", () => {
    expect(canonicalMimeType("brief.pdf")).toBe("application/pdf");
    expect(canonicalMimeType("photo.jpg")).toBe("image/jpeg");
    expect(canonicalMimeType("photo.jpeg")).toBe("image/jpeg");
    expect(canonicalMimeType("photo.png")).toBe("image/png");
    expect(canonicalMimeType("old.doc")).toBe("application/msword");
    expect(canonicalMimeType("new.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(canonicalMimeType("old.xls")).toBe("application/vnd.ms-excel");
    expect(canonicalMimeType("new.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("is not fooled by a spoofable, case-varying extension", () => {
    expect(canonicalMimeType("Brief.PDF")).toBe("application/pdf");
    expect(canonicalMimeType("Report.DOCX")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("falls back to application/octet-stream for an unrecognized extension", () => {
    expect(canonicalMimeType("script.exe")).toBe("application/octet-stream");
    expect(canonicalMimeType("no-extension")).toBe("application/octet-stream");
  });
});

describe("sanitizeFileName", () => {
  it("strips path separators and unsafe characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("....etcpasswd");
    expect(sanitizeFileName("My Brief (final)!!.pdf")).toBe("My Brief (final).pdf");
  });

  it("never returns an empty string", () => {
    expect(sanitizeFileName("???")).toBe("file");
  });

  it("keeps a long name to a sane length", () => {
    expect(sanitizeFileName("a".repeat(300) + ".pdf").length).toBeLessThanOrEqual(150);
  });
});
