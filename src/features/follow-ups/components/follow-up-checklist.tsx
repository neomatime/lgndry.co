"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { setFollowUpChecklistItem } from "@/features/follow-ups/actions";
import { checklistProgress } from "@/features/follow-ups/list-view-model";
import { formatJohannesburgTimestamp } from "@/features/follow-ups/timestamp-label";
import type { FollowUpActionState, FollowUpChecklistItem } from "@/features/follow-ups/types";
import { cn } from "@/lib/utils/cn";

const FAILED = "We couldn't update that item just now. Please try again.";

type Feedback = { kind: "conflict" | "error"; message: string } | null;

/** The value the person just chose, tied to the item version it was chosen against, so it
 * stops applying the moment fresh data (a newer item version) arrives from the server. */
type Pending = { value: boolean; version: number };

function describe(result: FollowUpActionState): Feedback {
  if (result.status === "conflict")
    return {
      kind: "conflict",
      message: "This checklist changed elsewhere. Refresh to see the latest items.",
    };
  if (result.status === "not-found" || result.status === "invalid" || result.status === "error")
    return { kind: "error", message: result.message };
  return { kind: "error", message: FAILED };
}

export function ProgressSummary({
  completed,
  total,
  percent,
}: ReturnType<typeof checklistProgress>) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-ink-muted text-sm whitespace-nowrap">
        {completed} of {total} completed ({percent}%)
      </p>
      <div className="bg-line h-1.5 min-w-16 flex-1 overflow-hidden" aria-hidden="true">
        <div className="bg-ink h-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * The follow-up's checklist. While the follow-up is Open each item is a real checkbox that
 * saves on change; otherwise the list is read-only. Each save is checked against the item's own
 * version, so a stale tab gets a calm conflict message and a refresh path instead of
 * overwriting a newer change.
 */
export function FollowUpChecklist({
  items,
  editable,
}: {
  items: FollowUpChecklistItem[];
  editable: boolean;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, Pending>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const busy = useRef(false);

  const isDone = (item: FollowUpChecklistItem) => {
    const choice = choices[item.id];
    return choice && choice.version === item.version ? choice.value : item.isCompleted;
  };
  const shown = items.map((item) => ({ ...item, isCompleted: isDone(item) }));
  const progress = checklistProgress({ checklist: shown });

  function forget(id: string) {
    setChoices((current) => {
      const rest = { ...current };
      delete rest[id];
      return rest;
    });
  }

  async function toggle(item: FollowUpChecklistItem) {
    if (busy.current) return;
    busy.current = true;
    const next = !isDone(item);
    setFeedback(null);
    setPendingId(item.id);
    setChoices((current) => ({ ...current, [item.id]: { value: next, version: item.version } }));
    try {
      const result = await setFollowUpChecklistItem(item.id, next, item.version);
      if (result.status === "success") {
        startRefresh(() => router.refresh());
      } else {
        forget(item.id);
        setFeedback(describe(result));
      }
    } catch {
      forget(item.id);
      setFeedback({ kind: "error", message: FAILED });
    } finally {
      busy.current = false;
      setPendingId(null);
    }
  }

  if (items.length === 0) return <p className="text-ink-muted text-sm">No checklist items.</p>;

  return (
    <div className="flex flex-col gap-4">
      <ProgressSummary {...progress} />
      <ul className="divide-line border-line divide-y border-y">
        {items.map((item) => {
          const done = isDone(item);
          return (
            <li key={item.id} className="py-3">
              {editable ? (
                <label
                  className={cn(
                    "flex min-w-0 items-start gap-3 text-sm",
                    pendingId === item.id && "opacity-70",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0"
                    checked={done}
                    disabled={pendingId !== null}
                    aria-busy={pendingId === item.id}
                    onChange={() => void toggle(item)}
                  />
                  <ItemText item={item} done={done} />
                </label>
              ) : (
                <div className="flex min-w-0 items-start gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className="border-ink mt-0.5 flex size-4 shrink-0 items-center justify-center border"
                  >
                    {done ? <Check className="size-3" /> : null}
                  </span>
                  <ItemText item={item} done={done} spoken />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {feedback ? (
        <div
          role={feedback.kind === "conflict" ? "status" : "alert"}
          className="border-line-strong flex flex-wrap items-center justify-between gap-3 border p-3 text-sm"
        >
          <p className="min-w-0 break-words">{feedback.message}</p>
          {feedback.kind === "conflict" ? (
            <button
              type="button"
              className="border-line-strong hover:bg-surface-soft h-9 border bg-white px-3 text-sm font-medium"
              onClick={() => {
                setFeedback(null);
                setChoices({});
                startRefresh(() => router.refresh());
              }}
            >
              Refresh checklist
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ItemText({
  item,
  done,
  spoken = false,
}: {
  item: FollowUpChecklistItem;
  done: boolean;
  /** Read-only items are not checkboxes, so their state is spoken in text instead. */
  spoken?: boolean;
}) {
  const completedOn =
    done && item.isCompleted && item.completedAt
      ? formatJohannesburgTimestamp(item.completedAt)
      : "";
  return (
    <span className="min-w-0 flex-1">
      <span className={cn("break-words", done && "text-ink-muted line-through")}>
        {item.label}
        {spoken ? <span className="sr-only">{done ? " (done)" : " (not done)"}</span> : null}
      </span>
      {completedOn ? (
        <span className="text-ink-muted mt-0.5 block text-xs">Completed {completedOn}</span>
      ) : null}
    </span>
  );
}
