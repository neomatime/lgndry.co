"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setEnquiryStatus } from "@/features/enquiries/actions";
import {
  MANUAL_ENQUIRY_STATUSES,
  type EnquiryStatus,
  type ManualEnquiryStatus,
} from "@/features/enquiries/types";

export function EnquiryStatusControl({
  enquiryId,
  status,
}: {
  enquiryId: string;
  status: EnquiryStatus;
}) {
  const router = useRouter();
  const initial = MANUAL_ENQUIRY_STATUSES.includes(status as ManualEnquiryStatus)
    ? (status as ManualEnquiryStatus)
    : "";
  const [selected, setSelected] = useState<ManualEnquiryStatus | "">(initial);
  const [message, setMessage] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!selected || selected === status) return;
    setMessage("");
    setProjectId(null);
    startTransition(async () => {
      try {
        const result = await setEnquiryStatus(enquiryId, selected);
        if (result.status !== "success") {
          setMessage(result.message);
          if (result.status === "conflict") setProjectId(result.projectId);
          return;
        }
        setMessage("Enquiry status updated.");
        router.refresh();
      } catch {
        setMessage("The enquiry status could not be updated.");
      }
    });
  }

  return (
    <section className="border-line flex flex-wrap items-center justify-between gap-4 border p-4">
      <div>
        <h2 className="text-sm font-medium">Enquiry Status</h2>
        <p className="text-ink-muted mt-1 text-sm">
          Booked and production statuses are managed through Projects.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label>
          <span className="sr-only">Enquiry status</span>
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value as ManualEnquiryStatus)}
            disabled={pending}
            className="border-line-strong h-10 border bg-white px-3 text-sm"
          >
            {!initial ? <option value="">Choose a status</option> : null}
            {MANUAL_ENQUIRY_STATUSES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <Button onClick={submit} disabled={pending || !selected || selected === status}>
          {pending ? "Updating..." : "Update Status"}
        </Button>
        <p aria-live="polite" className="w-full text-right text-xs">
          {message}{" "}
          {projectId ? (
            <Link href={`/ops/projects/${projectId}`} className="font-medium underline">
              Open project
            </Link>
          ) : null}
        </p>
      </div>
    </section>
  );
}
