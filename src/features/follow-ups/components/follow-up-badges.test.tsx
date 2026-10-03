import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PriorityBadge,
  ScheduleStateBadge,
} from "@/features/follow-ups/components/follow-up-badges";
import { FOLLOW_UP_PRIORITIES, type FollowUpScheduleState } from "@/features/follow-ups/types";

const STATES: [FollowUpScheduleState, string][] = [
  ["Overdue", "Overdue"],
  ["Today", "Due Today"],
  ["Upcoming", "Upcoming"],
  ["Completed", "Completed"],
  ["Cancelled", "Cancelled"],
];

describe("follow-up badges", () => {
  it.each(STATES)("spells out the %s scheduling state in text", (state, label) => {
    render(<ScheduleStateBadge state={state} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("separates every state by fill or outline, not just by its label", () => {
    const classes = STATES.map(([state, label]) => {
      const { unmount } = render(<ScheduleStateBadge state={state} />);
      const value = screen.getByText(label).className;
      unmount();
      return value;
    });
    expect(new Set(classes).size).toBe(STATES.length);
    expect(classes[0]).toContain("bg-ink");
    expect(classes[1]).toContain("border-ink");
    expect(classes[4]).toContain("border-dashed");
  });

  it("uses no colour outside the monochrome tokens", () => {
    for (const [state, label] of STATES) {
      const { unmount } = render(<ScheduleStateBadge state={state} />);
      expect(screen.getByText(label).className).not.toMatch(
        /(red|green|amber|yellow|orange|blue|rose|emerald)-/,
      );
      unmount();
    }
  });

  it.each(FOLLOW_UP_PRIORITIES)("spells out the %s priority in text", (priority) => {
    render(<PriorityBadge priority={priority} />);
    expect(screen.getByText(priority)).toBeInTheDocument();
  });

  it("keeps the priority gauge decorative and varies weight with priority", () => {
    const { container, rerender } = render(<PriorityBadge priority="High" />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText("High").className).toContain("font-semibold");
    rerender(<PriorityBadge priority="Low" />);
    expect(screen.getByText("Low").className).toContain("text-ink-muted");
  });
});
