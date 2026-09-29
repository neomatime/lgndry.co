"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setClientArchived } from "@/features/clients/actions";

type Feedback =
  | { status: "error"; message: string }
  | { status: "conflict"; message: string; clientId: string }
  | null;

export function ClientArchiveControl({
  clientId,
  clientName,
  archived,
}: {
  clientId: string;
  clientName: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const action = archived ? "Restore" : "Archive";

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await setClientArchived(clientId, !archived);
        if (result.status === "success") {
          setConfirming(false);
          router.refresh();
          return;
        }
        if (result.status === "conflict") {
          setFeedback({
            status: "conflict",
            message: result.error,
            clientId: result.clientId,
          });
          return;
        }
        setFeedback({ status: "error", message: result.error });
      } catch {
        setFeedback({
          status: "error",
          message: `We couldn't ${action.toLowerCase()} this client just now. Please try again.`,
        });
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
        {action} Client
      </Button>
    );
  }

  return (
    <div className="border-line-strong flex max-w-md flex-col gap-3 border p-4">
      <p className="text-sm font-medium">
        {action} {clientName}?
      </p>
      <p className="text-ink-muted text-xs">
        {archived
          ? "The client and contacts will return to active records."
          : "The client will move out of active views. Linked enquiries will be preserved."}
      </p>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending ? `${action}ing...` : `Confirm ${action}`}
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
      {feedback ? (
        <p role="alert" className="text-sm">
          {feedback.message}{" "}
          {feedback.status === "conflict" ? (
            <Link href={`/ops/clients/${feedback.clientId}`} className="font-medium underline">
              View existing client
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
