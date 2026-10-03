import type { FollowUpPriority, FollowUpScheduleState } from "@/features/follow-ups/types";
import { cn } from "@/lib/utils/cn";

/**
 * The design system is monochrome, so state is carried by the text itself and then
 * reinforced by weight, fill and outline, never by hue:
 *   Overdue    solid ink fill (the one state that demands action)
 *   Due Today  strong ink outline
 *   Upcoming   neutral fill
 *   Completed  quiet solid outline
 *   Cancelled  quiet dashed outline
 */
const STATE_LABEL: Record<FollowUpScheduleState, string> = {
  Overdue: "Overdue",
  Today: "Due Today",
  Upcoming: "Upcoming",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

const STATE_CLASSES: Record<FollowUpScheduleState, string> = {
  Overdue: "bg-ink text-white",
  Today: "border-ink text-ink border",
  Upcoming: "bg-line text-ink",
  Completed: "border-line-strong text-ink-muted border",
  Cancelled: "border-line-strong text-ink-muted border border-dashed",
};

export function followUpStateLabel(state: FollowUpScheduleState) {
  return STATE_LABEL[state];
}

export function ScheduleStateBadge({ state }: { state: FollowUpScheduleState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        STATE_CLASSES[state],
      )}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

const PRIORITY_LEVEL: Record<FollowUpPriority, number> = { Low: 1, Medium: 2, High: 3 };

/**
 * Priority is plain text led by a three-step bar gauge (decorative; the word is the
 * information) so it reads differently from the status pills beside it.
 */
export function PriorityBadge({ priority }: { priority: FollowUpPriority }) {
  const level = PRIORITY_LEVEL[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        priority === "High" && "text-ink font-semibold",
        priority === "Medium" && "text-ink font-medium",
        priority === "Low" && "text-ink-muted",
      )}
    >
      <span aria-hidden="true" className="flex items-end gap-0.5">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn(
              "w-[3px]",
              step === 1 && "h-1.5",
              step === 2 && "h-2",
              step === 3 && "h-2.5",
              step <= level ? "bg-ink" : "bg-line-strong",
            )}
          />
        ))}
      </span>
      {priority}
    </span>
  );
}
