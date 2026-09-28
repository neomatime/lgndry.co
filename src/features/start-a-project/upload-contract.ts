import { canonicalMimeType, sanitizeFileName } from "./file-validation";

export type UploadDescriptor = {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
};

export type PreparedUpload = UploadDescriptor & {
  index: number;
  storagePath: string;
  uploadUrl: string;
};

export type PrepareEnquiryResult =
  | {
      status: "ready";
      sessionId: string;
      sessionSecret: string;
      uploads: PreparedUpload[];
    }
  | { status: "accepted" }
  | {
      status: "error";
      code: "invalid" | "rate-limited" | "failed";
      error: string;
    };

export type FinalizeEnquiryResult =
  | { status: "complete" }
  | {
      status: "error";
      code: "invalid" | "expired" | "failed";
      error: string;
    };

export function descriptorForFile(file: File): UploadDescriptor {
  return {
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: canonicalMimeType(file.name),
  };
}

export function storagePathFor(sessionId: string, index: number, fileName: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
  ) {
    throw new Error("Invalid upload session id.");
  }
  if (!Number.isInteger(index) || index < 0 || index > 4) {
    throw new Error("Invalid upload index.");
  }
  return `${sessionId}/${index}-${sanitizeFileName(fileName)}`;
}
