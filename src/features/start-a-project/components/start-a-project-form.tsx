"use client";

import { useRef, useState } from "react";
import { Select } from "@/components/site/forms/select";
import { CONTACT_EMAIL } from "@/content/site";
import { submitProjectEnquiry } from "@/features/start-a-project/actions";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILES,
  MAX_FILE_BYTES,
  checkFileCount,
  checkFileMeta,
} from "@/features/start-a-project/file-validation";
import { PROJECT_TYPES } from "@/features/start-a-project/schemas";

const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(",");
const MAX_FILE_MB = Math.round(MAX_FILE_BYTES / (1024 * 1024));

type Status = "idle" | "sending" | "sent" | "failed";

const GENERIC_FAILURE = (
  <>
    Something went wrong sending your project. Please try again or email us directly at{" "}
    {CONTACT_EMAIL}.
  </>
);

/**
 * The single, short "Start a Project" form: the one form in the new design
 * that collects file attachments (a project brief, references, and
 * similar). Fields match the website refinement scope's §11 exactly.
 */
export function StartAProjectForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [projectType, setProjectType] = useState<string>(PROJECT_TYPES[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const onFilesChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    const combined = [...files, ...chosen];
    const countCheck = checkFileCount(combined.length);
    if (!countCheck.ok) {
      setFileError(countCheck.error);
      event.target.value = "";
      return;
    }
    for (const file of chosen) {
      const metaCheck = checkFileMeta(file.name, file.size);
      if (!metaCheck.ok) {
        setFileError(metaCheck.error);
        event.target.value = "";
        return;
      }
    }
    setFileError("");
    setFiles(combined);
    event.target.value = ""; // lets the same file be re-picked after a removal
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
    setFileError("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    if (formRef.current && !formRef.current.reportValidity()) return;
    setStatus("sending");
    setServerError(null);
    const formData = new FormData(formRef.current ?? undefined);
    for (const file of files) formData.append("attachments", file);
    try {
      const result = await submitProjectEnquiry(formData);
      if (result.ok) {
        setStatus("sent");
      } else {
        setStatus("failed");
        setServerError(result.error);
      }
    } catch (error) {
      console.error("Start a Project submission failed", error);
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

  return (
    <form
      ref={formRef}
      className="contact-form"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      {/* Spam trap: invisible to people, tempting to bots. */}
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
          <input type="file" multiple accept={ACCEPT_ATTRIBUTE} onChange={onFilesChosen} />
        </label>
        <p className="project-enquiry-form__file-hint">
          PDF, JPG, PNG, DOC, DOCX, XLS or XLSX — up to {MAX_FILES} files, {MAX_FILE_MB} MB each.
        </p>
        {files.length ? (
          <ul className="project-enquiry-form__file-list">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>{file.name}</span>
                <button type="button" onClick={() => removeFile(index)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {fileError ? <p className="contact-form__error">{fileError}</p> : null}
      </div>

      {status === "failed" ? (
        <p className="contact-form__error" data-contact-error="">
          {serverError ?? GENERIC_FAILURE}
        </p>
      ) : null}

      <div className="contact-form__actions">
        <button className="contact-submit" type="submit" disabled={status === "sending"}>
          <span>{status === "sending" ? "Sending..." : "Send project details"}</span>
        </button>
      </div>
    </form>
  );
}
