import "server-only";
import { checkFileContent, FILE_SIGNATURE_BYTES } from "./file-validation";
import type { UploadedFile } from "./records";

const BUCKET = "enquiry-attachments";

type StorageInfo = {
  size?: number;
  contentType?: string;
};

type StorageResult<T> = Promise<
  { data: T; error: null } | { data: null; error: { message: string } }
>;

export type StorageVerificationClient = {
  storage: {
    from: (bucket: string) => {
      info: (path: string) => StorageResult<StorageInfo>;
      remove: (paths: string[]) => StorageResult<unknown[]>;
    };
  };
};

export type StoredObjectCheck =
  { ok: true } | { ok: false; reason: "missing" | "size" | "mime" | "content" | "unavailable" };

type VerificationOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
  correlationId?: string;
};

function trace(options: VerificationOptions, stage: string) {
  if (options.correlationId) {
    console.info(`start-a-project: verify ${stage}`, options.correlationId);
  }
}

function encodedObjectPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function readPrefix(response: Response): Promise<Uint8Array | null> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const prefix = new Uint8Array(FILE_SIGNATURE_BYTES);
  let written = 0;

  try {
    while (written < prefix.length) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.byteLength, prefix.length - written);
      prefix.set(value.subarray(0, take), written);
      written += take;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return prefix.slice(0, written);
}

export async function verifyStoredObject(
  client: StorageVerificationClient,
  file: UploadedFile,
  options: VerificationOptions,
): Promise<StoredObjectCheck> {
  const bucket = client.storage.from(BUCKET);
  trace(options, "info start");
  const { data: info, error: infoError } = await bucket.info(file.storage_path);
  trace(options, "info complete");

  if (infoError) return { ok: false, reason: "unavailable" };
  if (!info) return { ok: false, reason: "missing" };
  if (info.size !== file.size_bytes) return { ok: false, reason: "size" };
  if (info.contentType !== file.mime_type) return { ok: false, reason: "mime" };

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    trace(options, "prefix fetch start");
    response = await fetchImpl(
      `${options.supabaseUrl}/storage/v1/object/authenticated/${BUCKET}/${encodedObjectPath(file.storage_path)}`,
      {
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: `Bearer ${options.serviceRoleKey}`,
          Range: `bytes=0-${FILE_SIGNATURE_BYTES - 1}`,
        },
      },
    );
    trace(options, "prefix fetch complete");
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) return { ok: false, reason: "unavailable" };
  const prefix = await readPrefix(response);
  trace(options, "prefix read complete");
  if (!prefix) return { ok: false, reason: "unavailable" };

  return checkFileContent(file.file_name, prefix).ok
    ? { ok: true }
    : { ok: false, reason: "content" };
}

export async function cleanupSessionObjects(
  client: StorageVerificationClient,
  manifest: UploadedFile[],
): Promise<boolean> {
  const paths = manifest.map((file) => file.storage_path);
  if (paths.length === 0) return true;
  const { error } = await client.storage.from(BUCKET).remove(paths);
  return error === null;
}
