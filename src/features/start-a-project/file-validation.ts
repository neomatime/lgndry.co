// Validates a "Start a Project" file attachment. Every check here is
// authoritative — the form re-runs the cheap checks (extension, size) in
// the browser for instant feedback, but only this module's result is
// trusted before a file is uploaded or recorded.

export type FileFamily = "pdf" | "jpeg" | "png" | "ole" | "zip-office";

const SIGNATURES: { family: FileFamily; bytes: number[] }[] = [
  { family: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { family: "jpeg", bytes: [0xff, 0xd8, 0xff] },
  { family: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { family: "ole", bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // legacy .doc / .xls
  { family: "zip-office", bytes: [0x50, 0x4b, 0x03, 0x04] }, // .docx / .xlsx (Zip container)
];

/**
 * Legacy .doc and .xls share one container signature (OLE Compound File),
 * and modern .docx and .xlsx share another (Zip) — this can confirm the
 * family, not the exact legacy-vs-modern pairing within it. Both members of
 * each pair are equally legitimate business documents; the real threat this
 * guards against (an executable or script disguised as a document) is
 * caught either way, since none of it matches any of these five signatures.
 */
export function detectFamily(bytes: Uint8Array): FileFamily | null {
  for (const signature of SIGNATURES) {
    if (bytes.length < signature.bytes.length) continue;
    if (signature.bytes.every((byte, index) => bytes[index] === byte)) return signature.family;
  }
  return null;
}

const EXTENSION_FAMILY: Record<string, FileFamily> = {
  pdf: "pdf",
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  doc: "ole",
  xls: "ole",
  docx: "zip-office",
  xlsx: "zip-office",
};

export const ALLOWED_EXTENSIONS = Object.keys(EXTENSION_FAMILY);
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_FILES = 5;
export const FILE_SIGNATURE_BYTES = 16;

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/**
 * The canonical MIME type for an extension, matching the Storage bucket's
 * `allowed_mime_types` list exactly (see
 * supabase/migrations/20260927_enquiries_and_attachments.sql). The
 * browser-declared `file.type` is spoofable and, for `.doc`/`.docx`/`.xls`/
 * `.xlsx` on many OSes, often just an empty string -- so this is what
 * should be used for both the Storage upload's `contentType` and the
 * `mime_type` sent to `submit_enquiry`, never `file.type`. Only call this
 * after `checkFileContent` has confirmed the file's real byte signature
 * matches its extension.
 */
export function canonicalMimeType(fileName: string): string {
  const extension = extensionOf(fileName);
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}

export type FileCheck = { ok: true } | { ok: false; error: string };

/** Cheap checks that don't need the file's bytes: extension and size. */
export function checkFileMeta(fileName: string, size: number): FileCheck {
  const extension = extensionOf(fileName);
  if (!EXTENSION_FAMILY[extension]) {
    return {
      ok: false,
      error: `${fileName}: only PDF, JPG, PNG, DOC, DOCX, XLS and XLSX files are accepted.`,
    };
  }
  if (size <= 0) return { ok: false, error: `${fileName} is empty.` };
  if (size > MAX_FILE_BYTES) return { ok: false, error: `${fileName} is over the 15 MB limit.` };
  return { ok: true };
}

/** Confirms a file's real content matches what its extension claims. */
export function checkFileContent(fileName: string, bytes: Uint8Array): FileCheck {
  const extension = extensionOf(fileName);
  const expected = EXTENSION_FAMILY[extension];
  if (!expected) return { ok: false, error: `${fileName}: unsupported file type.` };
  if (detectFamily(bytes) !== expected) {
    return {
      ok: false,
      error: `${fileName} does not look like a valid ${extension.toUpperCase()} file.`,
    };
  }
  return { ok: true };
}

export function checkFileCount(count: number): FileCheck {
  if (count > MAX_FILES) return { ok: false, error: `Please attach at most ${MAX_FILES} files.` };
  return { ok: true };
}

/** Strips path separators and anything outside a safe filename charset. */
export function sanitizeFileName(fileName: string): string {
  const safe = fileName.replace(/[\\/]/g, "").replace(/[^\w.\- ()]/g, "");
  return safe.slice(-150) || "file";
}
