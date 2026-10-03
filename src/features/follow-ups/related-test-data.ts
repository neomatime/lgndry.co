import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";
import {
  buildParentFollowUps,
  type ParentFollowUps,
} from "@/features/follow-ups/related-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";

// Wednesday 30 September 2026, 10:00 in Johannesburg.
export const RELATED_NOW = new Date("2026-09-30T08:00:00Z");

/** A parent's follow-ups section data: a live parent with a live client unless overridden. */
export function parentFollowUps(
  rows: FollowUpListItem[] = [],
  overrides: Partial<Pick<ParentFollowUps, "archived" | "clientId" | "clientArchived">> = {},
): ParentFollowUps {
  return buildParentFollowUps(rows, RELATED_NOW, {
    archived: false,
    clientId: "22222222-2222-4222-8222-222222222222",
    clientArchived: false,
    ...overrides,
  });
}

/** One open and one completed follow-up, for tests that need something to list. */
export function sampleFollowUpRows(): FollowUpListItem[] {
  return [
    followUpDetail({
      id: "fu-open",
      title: "Chase the autumn quote",
      dueDate: "2026-10-05",
      dueTime: "",
    }),
    followUpDetail({
      id: "fu-done",
      title: "Thank the client",
      status: "Completed",
      completedAt: "2026-09-29T08:00:00Z",
    }),
  ];
}
