export type SignedUploadOptions = {
  file: File;
  uploadUrl: string;
  onProgress: (percentage: number) => void;
};

export type SignedUploadHandle = {
  done: Promise<void>;
  abort: () => Promise<void>;
};

function uploadBody(file: File): FormData {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  return body;
}

/** Uploads directly to Supabase Storage using its path-scoped signed URL. */
export function startSignedUpload(options: SignedUploadOptions): SignedUploadHandle {
  const request = new XMLHttpRequest();
  let settled = false;
  let resolveDone: () => void = () => undefined;
  let rejectDone: (error: Error) => void = () => undefined;

  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const succeed = () => {
    if (settled) return;
    settled = true;
    resolveDone();
  };
  const fail = (message: string) => {
    if (settled) return;
    settled = true;
    rejectDone(new Error(message));
  };

  request.upload.addEventListener("progress", (event) => {
    if (!event.lengthComputable || event.total <= 0) return;
    const percentage = (event.loaded / event.total) * 100;
    options.onProgress(Math.min(100, Math.max(0, percentage)));
  });
  request.addEventListener("load", () => {
    if (request.status >= 200 && request.status < 300) succeed();
    else fail("Upload failed.");
  });
  request.addEventListener("error", () => fail("Upload failed."));
  request.addEventListener("timeout", () => fail("Upload timed out."));
  request.addEventListener("abort", () => fail("Upload cancelled."));

  request.open("PUT", options.uploadUrl);
  request.setRequestHeader("x-upsert", "false");
  request.send(uploadBody(options.file));

  return {
    done,
    abort: async () => {
      if (!settled) request.abort();
    },
  };
}
