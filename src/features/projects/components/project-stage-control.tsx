"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { moveProject } from "@/features/projects/actions";
import { PROJECT_STATUSES, type ProjectStatus } from "@/features/projects/types";

export function ProjectStageControl({
  projectId,
  status,
  stagePosition,
}: {
  projectId: string;
  status: ProjectStatus;
  stagePosition: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ProjectStatus>(status);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (selected === status) {
      setMessage("Choose a different stage or outcome.");
      return;
    }
    setMessage("");
    startTransition(async () => {
      try {
        const destinationPosition = selected === status ? stagePosition : 2_147_483_647;
        const result = await moveProject(projectId, selected, destinationPosition);
        if (result.status !== "success") {
          setMessage(
            "message" in result ? result.message : "The project stage could not be updated.",
          );
          return;
        }
        setMessage("Project stage updated.");
        router.refresh();
      } catch {
        setMessage("The project stage could not be updated.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label>
        <span className="sr-only">Project stage</span>
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value as ProjectStatus)}
          disabled={pending}
          className="border-line-strong h-10 border bg-white px-3 text-sm"
        >
          {PROJECT_STATUSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <Button onClick={submit} disabled={pending || selected === status}>
        {pending ? "Updating..." : "Update Stage"}
      </Button>
      <p aria-live="polite" className="w-full text-right text-xs">
        {message}
      </p>
    </div>
  );
}
