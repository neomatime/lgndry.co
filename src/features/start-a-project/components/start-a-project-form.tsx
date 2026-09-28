"use client";

import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/site/forms/select";
import { CONTACT_EMAIL } from "@/content/site";
import { finalizeProjectEnquiry, prepareProjectEnquiry } from "@/features/start-a-project/actions";
import {
  ALLOWED_EXTENSIONS,
  FILE_SIGNATURE_BYTES,
  MAX_FILES,
  MAX_FILE_BYTES,
  checkFileContent,
  checkFileCount,
  checkFileMeta,
} from "@/features/start-a-project/file-validation";
import { PROJECT_TYPES } from "@/features/start-a-project/schemas";
import { startTusUpload, type TusUploadHandle } from "@/features/start-a-project/tus-upload";
import {
  descriptorForFile,
  directStorageEndpoint,
  type PreparedUpload,
} from "@/features/start-a-project/upload-contract";
import { getPublicEnv } from "@/lib/env";

const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(",");
const MAX_FILE_MB = Math.round(MAX_FILE_BYTES / (1024 * 1024));

type FormStage = "idle" | "preparing" | "uploading" | "finalizing" | "sent" | "failed";
type FileStage = "waiting" | "uploading" | "uploaded" | "failed";

type SelectedFile = {
  id: string;
  file: File;
  stage: FileStage;
  progress: number;
  error?: string;
};

type ActiveSession = {
  formData: FormData;
  sessionId: string;
  sessionSecret: string;
  uploads: PreparedUpload[];
};

const GENERIC_FAILURE = (
  <>
    Something went wrong sending your project. Please try again or email us directly at{" "}
    {CONTACT_EMAIL}.
  </>
);

function textFormData(form: HTMLFormElement): FormData {
  const text = new FormData();
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string") text.append(key, value);
  }
  return text;
}

function fileStatus(file: SelectedFile): string {
  if (file.stage === "uploading") return `${Math.round(file.progress)}%`;
  if (file.stage === "uploaded") return "Uploaded";
  if (file.stage === "failed") return "Failed";
  return "Waiting";
}

/**
 * The single, short "Start a Project" form. Attachment bytes travel directly
 * from the browser to private Supabase Storage; Server Actions receive only
 * text fields, file descriptors, and the upload-session capability.
 */
export function StartAProjectForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const mountedRef = useRef(true);
  const filesRef = useRef<SelectedFile[]>([]);
  const sessionRef = useRef<ActiveSession | null>(null);
  const handlesRef = useRef(new Map<string, TusUploadHandle>());
  const selectionVersion = useRef(0);
  const [projectType, setProjectType] = useState<string>(PROJECT_TYPES[0]);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [fileError, setFileError] = useState("");
  const [status, setStatus] = useState<FormStage>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  const replaceFiles = (next: SelectedFile[]) => {
    if (!mountedRef.current) return;
    filesRef.current = next;
    setFiles(next);
  };

  const updateFile = (id: string, patch: Partial<Omit<SelectedFile, "id" | "file">>) => {
    replaceFiles(
      filesRef.current.map((selected) =>
        selected.id === id ? { ...selected, ...patch } : selected,
      ),
    );
  };

  useEffect(() => {
    mountedRef.current = true;
    const handles = handlesRef.current;
    return () => {
      mountedRef.current = false;
      for (const handle of handles.values()) {
        void handle.abort().catch(() => undefined);
      }
      handles.clear();
    };
  }, []);

  const onFilesChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    const version = ++selectionVersion.current;
    const countCheck = checkFileCount(filesRef.current.length + chosen.length);

    if (!countCheck.ok) {
      setFileError(countCheck.error);
      return;
    }

    try {
      for (const file of chosen) {
        const metaCheck = checkFileMeta(file.name, file.size);
        if (!metaCheck.ok) {
          setFileError(metaCheck.error);
          return;
        }
        const prefix = new Uint8Array(await file.slice(0, FILE_SIGNATURE_BYTES).arrayBuffer());
        const contentCheck = checkFileContent(file.name, prefix);
        if (!contentCheck.ok) {
          setFileError(contentCheck.error);
          return;
        }
      }
    } catch {
      setFileError("We couldn't read that attachment. Please choose it again.");
      return;
    }

    if (version !== selectionVersion.current) return;
    replaceFiles([
      ...filesRef.current,
      ...chosen.map((file) => ({
        id: crypto.randomUUID(),
        file,
        stage: "waiting" as const,
        progress: 0,
      })),
    ]);
    setFileError("");
  };

  const removeFile = (id: string) => {
    if (sessionRef.current) return;
    replaceFiles(filesRef.current.filter((file) => file.id !== id));
    setFileError("");
  };

  const uploadFile = async (
    selected: SelectedFile,
    prepared: PreparedUpload,
    endpoint: string,
  ): Promise<boolean> => {
    updateFile(selected.id, { stage: "uploading", progress: 0, error: undefined });
    let handle: TusUploadHandle | null = null;

    try {
      handle = startTusUpload({
        file: selected.file,
        endpoint,
        token: prepared.token,
        storagePath: prepared.storagePath,
        mimeType: prepared.mimeType,
        onProgress: (progress) => updateFile(selected.id, { progress }),
      });
      handlesRef.current.set(selected.id, handle);
      await handle.done;
      updateFile(selected.id, { stage: "uploaded", progress: 100, error: undefined });
      return true;
    } catch {
      updateFile(selected.id, {
        stage: "failed",
        error: "Upload interrupted. Retry this file.",
      });
      return false;
    } finally {
      if (handle && handlesRef.current.get(selected.id) === handle) {
        handlesRef.current.delete(selected.id);
      }
    }
  };

  const finishSession = async (session: ActiveSession) => {
    setStatus("finalizing");
    setServerError(null);
    try {
      const result = await finalizeProjectEnquiry(
        session.formData,
        session.sessionId,
        session.sessionSecret,
      );
      if (result.status === "complete") {
        sessionRef.current = null;
        setHasSession(false);
        setStatus("sent");
        return;
      }
      setStatus("failed");
      setServerError(result.error);
    } catch {
      setStatus("failed");
      setServerError(null);
    }
  };

  const retryFile = async (id: string) => {
    const session = sessionRef.current;
    const index = filesRef.current.findIndex((file) => file.id === id);
    const selected = filesRef.current[index];
    const prepared = session?.uploads[index];
    if (!session || !selected || !prepared || selected.stage !== "failed") return;

    setStatus("uploading");
    setServerError(null);
    try {
      const endpoint = directStorageEndpoint(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL);
      const succeeded = await uploadFile(selected, prepared, endpoint);
      if (succeeded && filesRef.current.every((file) => file.stage === "uploaded")) {
        await finishSession(session);
      } else if (!succeeded || filesRef.current.some((file) => file.stage === "failed")) {
        setStatus("failed");
        setServerError("One or more attachments need to be retried.");
      }
    } catch {
      setStatus("failed");
      setServerError(null);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (["preparing", "uploading", "finalizing"].includes(status)) return;
    if (formRef.current && !formRef.current.reportValidity()) return;

    const activeSession = sessionRef.current;
    if (activeSession) {
      if (filesRef.current.every((file) => file.stage === "uploaded")) {
        await finishSession(activeSession);
      }
      return;
    }

    const form = formRef.current;
    if (!form) return;

    setStatus("preparing");
    setServerError(null);

    try {
      const endpoint = directStorageEndpoint(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL);
      const formData = textFormData(form);
      const result = await prepareProjectEnquiry(
        formData,
        filesRef.current.map(({ file }) => descriptorForFile(file)),
      );

      if (result.status === "accepted") {
        setStatus("sent");
        return;
      }
      if (result.status === "error") {
        setStatus("failed");
        setServerError(result.error);
        return;
      }
      if (result.uploads.length !== filesRef.current.length) {
        setStatus("failed");
        setServerError(null);
        return;
      }

      const session: ActiveSession = {
        formData,
        sessionId: result.sessionId,
        sessionSecret: result.sessionSecret,
        uploads: result.uploads,
      };
      sessionRef.current = session;
      setHasSession(true);

      if (filesRef.current.length === 0) {
        await finishSession(session);
        return;
      }

      setStatus("uploading");
      const selectedFiles = [...filesRef.current];
      const results = await Promise.all(
        selectedFiles.map((selected, index) =>
          uploadFile(selected, result.uploads[index]!, endpoint),
        ),
      );

      if (results.every(Boolean)) {
        await finishSession(session);
      } else {
        setStatus("failed");
        setServerError("One or more attachments need to be retried.");
      }
    } catch {
      setStatus("failed");
      setServerError(null);
    }
  };

  if (status === "sent") {
    return (
      <div className="contact-form__section contact-form__section--success">
        <h3>Project received</h3>
        <p>Thank you for reaching out. We will be in touch within 24 hours.</p>
      </div>
    );
  }

  const busy = status === "preparing" || status === "uploading" || status === "finalizing";
  const selectionLocked = hasSession || busy;
  const hasFailedUpload = files.some((file) => file.stage === "failed");
  const buttonLabel =
    status === "preparing"
      ? "Preparing..."
      : status === "uploading"
        ? "Uploading..."
        : status === "finalizing"
          ? "Finishing..."
          : hasSession && files.every((file) => file.stage === "uploaded")
            ? "Try finishing again"
            : "Send project details";

  return (
    <form
      ref={formRef}
      className="contact-form"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <input
        type="text"
        name="hp_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <label>
        <span>Your name</span>
        <input type="text" name="full_name" autoComplete="name" required />
      </label>
      <label>
        <span>Company / brand</span>
        <input type="text" name="company" autoComplete="organization" placeholder="Optional" />
      </label>
      <label>
        <span>Email address</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label>
        <span>Phone / WhatsApp</span>
        <input type="tel" name="phone" autoComplete="tel" required />
      </label>
      <label>
        <span>Project type</span>
        <Select
          name="project_type"
          required
          options={PROJECT_TYPES}
          value={projectType}
          onChange={setProjectType}
          label="Project type"
        />
      </label>
      <label>
        <span>Location</span>
        <input type="text" name="location" required />
      </label>
      <label>
        <span>Timeline</span>
        <input type="text" name="timeline" placeholder="e.g. Next 1-3 months" required />
      </label>
      <label className="contact-form__wide">
        <span>Tell us about the project</span>
        <textarea name="description" rows={5} required></textarea>
      </label>
      <label>
        <span>Budget</span>
        <input type="text" name="budget" placeholder="Optional" />
      </label>

      <div className="project-enquiry-form__files contact-form__wide">
        <label>
          <span>Attachments</span>
          <input
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            disabled={selectionLocked}
            onChange={(event) => void onFilesChosen(event)}
          />
        </label>
        <p className="project-enquiry-form__file-hint">
          PDF, JPG, PNG, DOC, DOCX, XLS or XLSX — up to {MAX_FILES} files, {MAX_FILE_MB} MB each.
        </p>
        {files.length ? (
          <ul className="project-enquiry-form__file-list">
            {files.map((selected) => (
              <li key={selected.id}>
                <div className="project-enquiry-form__file-copy">
                  <span className="project-enquiry-form__file-name">{selected.file.name}</span>
                  <span className="project-enquiry-form__file-status" aria-live="polite">
                    {fileStatus(selected)}
                  </span>
                </div>
                {selected.stage === "uploading" ? (
                  <progress
                    aria-label={`Upload progress for ${selected.file.name}`}
                    max={100}
                    value={selected.progress}
                  />
                ) : null}
                {selected.stage === "failed" ? (
                  <button type="button" onClick={() => void retryFile(selected.id)}>
                    Retry
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={selectionLocked}
                    onClick={() => removeFile(selected.id)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {fileError ? <p className="contact-form__error">{fileError}</p> : null}
      </div>

      {status === "failed" ? (
        <p className="contact-form__error" data-contact-error="" aria-live="polite">
          {serverError ?? GENERIC_FAILURE}
        </p>
      ) : null}

      <div className="contact-form__actions">
        <button
          className="contact-submit"
          type="submit"
          disabled={busy || (hasSession && hasFailedUpload)}
        >
          <span>{buttonLabel}</span>
        </button>
      </div>
    </form>
  );
}
