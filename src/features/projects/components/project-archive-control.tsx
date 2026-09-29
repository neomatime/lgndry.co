"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setProjectArchived } from "@/features/projects/actions";

export function ProjectArchiveControl({
  projectId,
  projectName,
  archived,
}: {
  projectId: string;
  projectName: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const action = archived ? "Restore" : "Archive";

  function submit() {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await setProjectArchived(projectId, !archived);
        if (result.status !== "success") {
          setMessage(
            "message" in result
              ? result.message
              : `The project could not be ${action.toLowerCase()}d.`,
          );
          return;
        }
        setConfirming(false);
        router.refresh();
      } catch {
        setMessage(`The project could not be ${action.toLowerCase()}d.`);
      }
    });
  }

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        {archived ? (
          <ArchiveRestore className="size-4" aria-hidden="true" />
        ) : (
          <Archive className="size-4" aria-hidden="true" />
        )}
        {action} Project
      </Button>
    );
  }

  return (
    <div className="border-line-strong flex max-w-md flex-col gap-3 border p-4">
      <p className="text-sm font-medium">
        {action} {projectName}?
      </p>
      <p className="text-ink-muted text-xs">
        {archived
          ? "The project will return to its saved production stage."
          : "The project will move out of active and outcome views. Its history and plan will be preserved."}
      </p>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending ? `${action}ing...` : `Confirm ${action}`}
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
      <p role={message ? "alert" : undefined} className="text-sm">
        {message}
      </p>
    </div>
  );
}
