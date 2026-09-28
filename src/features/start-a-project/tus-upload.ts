import { Upload } from "tus-js-client";

const TUS_CHUNK_BYTES = 6 * 1024 * 1024;
const RETRY_DELAYS = [0, 3000, 5000, 10000, 20000];

export type TusUploadOptions = {
  file: File;
  endpoint: string;
  token: string;
  storagePath: string;
  mimeType: string;
  onProgress: (percentage: number) => void;
};

export type TusUploadHandle = {
  done: Promise<void>;
  abort: () => Promise<void>;
};

export function startTusUpload(options: TusUploadOptions): TusUploadHandle {
  let resolveDone: () => void = () => undefined;
  let rejectDone: (error: Error) => void = () => undefined;
  let settled = false;

  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const settleSuccess = () => {
    if (settled) return;
    settled = true;
    resolveDone();
  };
  const settleError = (error: unknown) => {
    if (settled) return;
    settled = true;
    rejectDone(error instanceof Error ? error : new Error("Upload failed."));
  };

  const upload = new Upload(options.file, {
    endpoint: options.endpoint,
    chunkSize: TUS_CHUNK_BYTES,
    retryDelays: RETRY_DELAYS,
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    headers: { "x-signature": options.token },
    metadata: {
      bucketName: "enquiry-attachments",
      objectName: options.storagePath,
      contentType: options.mimeType,
      cacheControl: "3600",
    },
    onProgress: (bytesSent, bytesTotal) => {
      const percentage = bytesTotal > 0 ? (bytesSent / bytesTotal) * 100 : 0;
      options.onProgress(Math.min(100, Math.max(0, percentage)));
    },
    onSuccess: settleSuccess,
    onError: settleError,
  });

  void upload
    .findPreviousUploads()
    .then((previousUploads) => {
      const previous = previousUploads[0];
      if (previous) upload.resumeFromPreviousUpload(previous);
      upload.start();
    })
    .catch(settleError);

  return {
    done,
    abort: () => upload.abort(false),
  };
}
