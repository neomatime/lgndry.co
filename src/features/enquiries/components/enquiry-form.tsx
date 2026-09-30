"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateEnquiry } from "@/features/enquiries/actions";
import { enquiryEditSchema, type EnquiryEditInput } from "@/features/enquiries/schemas";
import { PROJECT_TYPES } from "@/features/start-a-project/schemas";

const inputClass = "border-line-strong h-10 border bg-white px-3 text-sm";
const textareaClass = "border-line-strong min-h-28 border bg-white px-3 py-2 text-sm";

function errorsFor(error: ReturnType<typeof enquiryEditSchema.safeParse>) {
  if (error.success) return {};
  const fields: Record<string, string[]> = {};
  for (const issue of error.error.issues) {
    const key = issue.path.join(".") || "form";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

function ErrorText({ messages }: { messages?: string[] }) {
  return messages?.length ? <span className="text-xs">{messages[0]}</span> : null;
}

export function EnquiryForm({
  enquiryId,
  initialValue,
}: {
  enquiryId: string;
  initialValue: EnquiryEditInput;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);

  const setField = <K extends keyof EnquiryEditInput>(key: K, next: EnquiryEditInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setMessage("");
    const parsed = enquiryEditSchema.safeParse(value);
    if (!parsed.success) {
      setFieldErrors(errorsFor(parsed));
      setMessage("Check the highlighted enquiry details and try again.");
      return;
    }
    setFieldErrors({});
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = await updateEnquiry(enquiryId, parsed.data);
        if (result.status === "success") {
          router.push(`/ops/enquiries/${result.enquiryId}`);
          router.refresh();
          return;
        }
        if (result.status === "invalid" && result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setMessage(result.message);
      } catch {
        setMessage("We couldn't save this enquiry just now. Please try again.");
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-4xl flex-col gap-8">
      <section className="border-line border p-5 sm:p-6">
        <h2 className="text-lg font-medium">Contact</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Contact name</span>
            <input
              value={value.fullName}
              onChange={(event) => setField("fullName", event.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.fullName} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Company</span>
            <input
              value={value.company}
              onChange={(event) => setField("company", event.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.company} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              value={value.email}
              onChange={(event) => setField("email", event.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.email} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Phone</span>
            <input
              value={value.phone}
              onChange={(event) => setField("phone", event.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.phone} />
          </label>
        </div>
      </section>

      <section className="border-line border p-5 sm:p-6">
        <h2 className="text-lg font-medium">Project Brief</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Project type</span>
            <select
              value={value.projectType}
              onChange={(event) =>
                setField("projectType", event.target.value as EnquiryEditInput["projectType"])
              }
              className={inputClass}
            >
              {PROJECT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Location</span>
            <input
              value={value.location}
              onChange={(event) => setField("location", event.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.location} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Timeline</span>
            <input
              value={value.timeline}
              onChange={(event) => setField("timeline", event.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.timeline} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Budget</span>
            <input
              value={value.budget}
              onChange={(event) => setField("budget", event.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.budget} />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Description</span>
            <textarea
              value={value.description}
              onChange={(event) => setField("description", event.target.value)}
              className={textareaClass}
            />
            <ErrorText messages={fieldErrors.description} />
          </label>
        </div>
      </section>

      {message ? (
        <p role="alert" className="border-line-strong border p-4 text-sm">
          {message}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Changes"}
        </Button>
        <Link
          href={`/ops/enquiries/${enquiryId}`}
          className="border-line-strong hover:bg-surface-soft inline-flex h-10 items-center border bg-white px-4 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
