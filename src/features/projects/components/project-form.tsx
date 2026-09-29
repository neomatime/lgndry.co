"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createProject, convertEnquiryToProject, updateProject } from "@/features/projects/actions";
import { ProjectPlanEditor } from "@/features/projects/components/project-plan-editor";
import { projectInputSchema } from "@/features/projects/schemas";
import {
  DELIVERY_STATUSES,
  PAYMENT_STATUSES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type ProjectClientOption,
  type ProjectInput,
} from "@/features/projects/types";

type Props = {
  mode: "create" | "edit" | "conversion";
  clients: ProjectClientOption[];
  initialValue?: ProjectInput;
  projectId?: string;
  enquiryId?: string;
  sourceTimeline?: string;
  sourceBudget?: string;
};

const inputClass = "border-line-strong h-10 w-full border bg-white px-3 text-sm";
const textareaClass =
  "border-line-strong min-h-28 w-full resize-y border bg-white px-3 py-2 text-sm";

function blank(): ProjectInput {
  return {
    name: "",
    clientId: "",
    clientContactId: "",
    projectType: "Other",
    services: [],
    overview: "",
    location: "",
    startDate: "",
    endDate: "",
    scheduleNotes: "",
    peopleResources: "",
    budgetMin: "",
    budgetMax: "",
    currency: "ZAR",
    paymentStatus: "Not Invoiced",
    deliveryStatus: "Not Ready",
    status: "Planning",
    milestones: [],
    tasks: [],
    deliverables: [],
  };
}

function errorsFor(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues)
    (errors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  return errors;
}

function ErrorText({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="mt-1 text-xs font-medium">{messages.join(" ")}</p> : null;
}

export function ProjectForm(props: Props) {
  const router = useRouter();
  const [value, setValue] = useState<ProjectInput>(props.initialValue ?? blank());
  const [serviceDraft, setServiceDraft] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<{ message: string; projectId?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  const selectedClient = props.clients.find((client) => client.id === value.clientId);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);
  const setField = <K extends keyof ProjectInput>(key: K, next: ProjectInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  function addService() {
    const service = serviceDraft.trim();
    if (!service || value.services.some((item) => item.toLowerCase() === service.toLowerCase()))
      return;
    setField("services", [...value.services, service]);
    setServiceDraft("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setFeedback(null);
    if (props.mode === "conversion" && !confirmed) {
      setFieldErrors({ confirmation: ["Confirm that the enquiry will be marked Booked."] });
      return;
    }
    const parsed = projectInputSchema.safeParse(value);
    if (!parsed.success) {
      setFieldErrors(errorsFor(parsed.error));
      setFeedback({ message: "Check the highlighted project details and try again." });
      return;
    }
    setFieldErrors({});
    submitting.current = true;
    startTransition(async () => {
      try {
        const result =
          props.mode === "edit"
            ? await updateProject(props.projectId!, parsed.data)
            : props.mode === "conversion"
              ? await convertEnquiryToProject(props.enquiryId!, parsed.data)
              : await createProject(parsed.data);
        if (result.status === "success") {
          router.push(`/ops/projects/${result.projectId}`);
          router.refresh();
          return;
        }
        if (result.status === "invalid" && result.fieldErrors) setFieldErrors(result.fieldErrors);
        setFeedback({
          message: "message" in result ? result.message : "The project could not be saved.",
          projectId: result.status === "conflict" ? result.projectId : undefined,
        });
      } catch {
        setFeedback({ message: "We couldn't save this project just now. Please try again." });
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-6xl flex-col gap-8">
      {props.mode === "conversion" ? (
        <div className="border-line border p-4 text-sm">
          <p className="font-medium">Creating from enquiry</p>
          <Link href={`/ops/enquiries/${props.enquiryId}`} className="mt-1 inline-block underline">
            Open source enquiry
          </Link>
        </div>
      ) : null}
      <section className="border-line border p-5 sm:p-6">
        <h2 className="text-lg font-medium">Profile</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Project name</span>
            <input
              value={value.name}
              onChange={(e) => setField("name", e.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.name} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Client</span>
            <select
              aria-label="Client"
              value={value.clientId}
              disabled={props.mode === "conversion"}
              onChange={(e) =>
                setValue((current) => ({
                  ...current,
                  clientId: e.target.value,
                  clientContactId: "",
                }))
              }
              className={inputClass}
            >
              <option value="">Choose a client</option>
              {props.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <ErrorText messages={fieldErrors.clientId} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Client contact</span>
            <select
              aria-label="Client contact"
              value={value.clientContactId}
              onChange={(e) => setField("clientContactId", e.target.value)}
              className={inputClass}
            >
              <option value="">No selected contact</option>
              {selectedClient?.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Project type</span>
            <select
              aria-label="Project type"
              value={value.projectType}
              onChange={(e) =>
                setField("projectType", e.target.value as ProjectInput["projectType"])
              }
              className={inputClass}
            >
              {PROJECT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Lifecycle</span>
            <select
              aria-label="Lifecycle"
              value={value.status}
              onChange={(e) => setField("status", e.target.value as ProjectInput["status"])}
              className={inputClass}
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Overview</span>
            <textarea
              value={value.overview}
              onChange={(e) => setField("overview", e.target.value)}
              className={textareaClass}
            />
          </label>
          <div className="sm:col-span-2">
            <label htmlFor="project-service" className="text-sm font-medium">
              Services
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="project-service"
                value={serviceDraft}
                onChange={(e) => setServiceDraft(e.target.value)}
                className={inputClass}
              />
              <Button type="button" variant="secondary" onClick={addService}>
                <Plus className="size-4" aria-hidden="true" />
                Add
              </Button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {value.services.map((service, index) => (
                <li
                  key={`${service}-${index}`}
                  className="bg-line inline-flex items-center gap-2 px-3 py-1.5 text-sm"
                >
                  {service}
                  <button
                    type="button"
                    aria-label={`Remove ${service}`}
                    onClick={() =>
                      setField(
                        "services",
                        value.services.filter((_, position) => position !== index),
                      )
                    }
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="border-line border p-5 sm:p-6">
        <h2 className="text-lg font-medium">Schedule</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Location</span>
            <input
              value={value.location}
              onChange={(e) => setField("location", e.target.value)}
              className={inputClass}
            />
          </label>
          <div />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Start date</span>
            <input
              type="date"
              value={value.startDate}
              onChange={(e) => setField("startDate", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">End date</span>
            <input
              type="date"
              value={value.endDate}
              onChange={(e) => setField("endDate", e.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.endDate} />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Schedule notes</span>
            <textarea
              value={value.scheduleNotes}
              onChange={(e) => setField("scheduleNotes", e.target.value)}
              className={textareaClass}
            />
            {props.sourceTimeline ? (
              <span className="text-ink-muted text-xs">
                Source timeline: {props.sourceTimeline}
              </span>
            ) : null}
          </label>
        </div>
      </section>
      <section className="border-line border p-5 sm:p-6">
        <h2 className="text-lg font-medium">Production</h2>
        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-sm font-medium">People / resources</span>
          <textarea
            value={value.peopleResources}
            onChange={(e) => setField("peopleResources", e.target.value)}
            className={textareaClass}
          />
        </label>
      </section>
      <section className="border-line border p-5 sm:p-6">
        <h2 className="text-lg font-medium">Financial Snapshot</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Budget minimum</span>
            <input
              inputMode="decimal"
              value={value.budgetMin}
              onChange={(e) => setField("budgetMin", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Budget maximum</span>
            <input
              inputMode="decimal"
              value={value.budgetMax}
              onChange={(e) => setField("budgetMax", e.target.value)}
              className={inputClass}
            />
            <ErrorText messages={fieldErrors.budgetMax} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Currency</span>
            <input
              value={value.currency}
              onChange={(e) => setField("currency", e.target.value.toUpperCase())}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Payment status</span>
            <select
              value={value.paymentStatus}
              onChange={(e) =>
                setField("paymentStatus", e.target.value as ProjectInput["paymentStatus"])
              }
              className={inputClass}
            >
              {PAYMENT_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Delivery status</span>
            <select
              value={value.deliveryStatus}
              onChange={(e) =>
                setField("deliveryStatus", e.target.value as ProjectInput["deliveryStatus"])
              }
              className={inputClass}
            >
              {DELIVERY_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
        {props.sourceBudget ? (
          <p className="text-ink-muted mt-3 text-xs">Source budget: {props.sourceBudget}</p>
        ) : null}
      </section>
      <ProjectPlanEditor
        milestones={value.milestones}
        tasks={value.tasks}
        deliverables={value.deliverables}
        onMilestonesChange={(milestones) => setField("milestones", milestones)}
        onTasksChange={(tasks) => setField("tasks", tasks)}
        onDeliverablesChange={(deliverables) => setField("deliverables", deliverables)}
      />
      {props.mode === "conversion" ? (
        <label className="border-line flex items-start gap-3 border p-4 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>I confirm that creating this project will mark the source enquiry as Booked.</span>
          <ErrorText messages={fieldErrors.confirmation} />
        </label>
      ) : null}
      {feedback ? (
        <p
          ref={feedbackRef}
          role="alert"
          tabIndex={-1}
          className="border-line-strong border p-4 text-sm"
        >
          {feedback.message}{" "}
          {feedback.projectId ? (
            <Link href={`/ops/projects/${feedback.projectId}`} className="font-medium underline">
              Open existing project
            </Link>
          ) : null}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : props.mode === "edit" ? "Save Changes" : "Create Project"}
        </Button>
        <Link
          href={props.mode === "edit" ? `/ops/projects/${props.projectId}` : "/ops/projects"}
          className="border-line-strong hover:bg-surface-soft inline-flex h-10 items-center border bg-white px-4 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
