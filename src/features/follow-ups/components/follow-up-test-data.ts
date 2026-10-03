import type { FollowUpDetail, FollowUpSeries } from "@/features/follow-ups/types";

export const FOLLOW_UP_ID = "11111111-1111-4111-8111-111111111111";
export const SUCCESSOR_ID = "22222222-2222-4222-8222-222222222222";
export const PREDECESSOR_ID = "33333333-3333-4333-8333-333333333333";

export function seriesOf(overrides: Partial<FollowUpSeries> = {}): FollowUpSeries {
  return {
    id: "series-1",
    frequency: "Weekly",
    intervalCount: 1,
    weekdays: [1],
    monthAnchor: null,
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=MO",
    endsOn: "",
    maxOccurrences: null,
    occurrencesCreated: 2,
    active: true,
    version: 1,
    ...overrides,
  };
}

/** A realistic Open follow-up due 2026-09-30 at 11:00 with a two-item checklist. */
export function followUpDetail(overrides: Partial<FollowUpDetail> = {}): FollowUpDetail {
  return {
    id: FOLLOW_UP_ID,
    reference: "FUP-0312",
    clientId: "client-1",
    clientName: "Blackridge Hotels",
    contact: {
      id: "contact-1",
      fullName: "James Mitchell",
      email: "james@blackridge.example",
      phone: "+27 82 555 0187",
      role: "Head of Marketing",
    },
    related: { id: "enquiry-1", label: "Documentary", kind: "Enquiry" },
    followUpType: "Quote Follow-up",
    customType: "",
    displayType: "Quote Follow-up",
    title: "Chase the autumn quote",
    overview: "The client has the quote and wants a fast turnaround.",
    notes: "Waiting on internal budget confirmation.",
    dueDate: "2026-09-30",
    dueTime: "11:00",
    priority: "High",
    contactMethods: ["Email", "Phone"],
    status: "Open",
    scheduleState: "Today",
    outcome: "",
    cancellationReason: "",
    completedAt: null,
    cancelledAt: null,
    owner: { id: "user-1", name: "Liam Parker", email: "liam@example.com" },
    seriesId: null,
    occurrenceNumber: 1,
    successorId: null,
    version: 4,
    createdAt: "2026-09-20T08:00:00Z",
    updatedAt: "2026-09-21T09:30:00Z",
    checklist: [
      {
        id: "item-1",
        label: "Review quote summary",
        sortOrder: 0,
        isCompleted: true,
        completedAt: "2026-09-29T22:30:00Z",
        version: 2,
      },
      {
        id: "item-2",
        label: "Confirm client feedback",
        sortOrder: 1,
        isCompleted: false,
        completedAt: null,
        version: 1,
      },
    ],
    series: null,
    predecessorId: null,
    activity: [
      {
        id: "act-1",
        message: "Follow-up created",
        action: "created",
        createdAt: "2026-09-20T08:00:00Z",
        relativeTime: "10 days ago",
      },
    ],
    ...overrides,
  };
}

/** An Open occurrence of an active weekly series. */
export function recurringDetail(overrides: Partial<FollowUpDetail> = {}): FollowUpDetail {
  return followUpDetail({
    seriesId: "series-1",
    series: seriesOf(),
    occurrenceNumber: 2,
    ...overrides,
  });
}
