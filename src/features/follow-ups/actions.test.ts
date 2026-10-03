import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FollowUpActionState } from "@/features/follow-ups/types";

const mocks = vi.hoisted(() => ({
  requireOpsUser: vi.fn(),
  createServer: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  nextOccurrenceDate: vi.fn(),
  createRecurrenceRule: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.requireOpsUser }));
vi.mock("@/lib/db/server", () => ({ createSupabaseServerClient: mocks.createServer }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/follow-ups/recurrence", () => ({
  nextOccurrenceDate: mocks.nextOccurrenceDate,
  createRecurrenceRule: mocks.createRecurrenceRule,
}));

import {
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  reopenFollowUp,
  rescheduleFollowUp,
  setFollowUpChecklistItem,
  updateFollowUp,
} from "@/features/follow-ups/actions";

const FAILED = "We couldn't save this follow-up just now. Please try again.";
const NOT_FOUND = { status: "not-found", message: "That follow-up is no longer available." };

const id = "123e4567-e89b-42d3-a456-426614174000";
const clientId = "223e4567-e89b-42d3-a456-426614174000";
const enquiryId = "323e4567-e89b-42d3-a456-426614174000";
const otherClientId = "423e4567-e89b-42d3-a456-426614174000";
const successorId = "523e4567-e89b-42d3-a456-426614174000";

// `nextDateFor` (used by completeFollowUp always, and cancelFollowUp only for
// an "occurrence" scope) reads `due_date`/series from `follow_ups`, separate
// from `fetchRelationIds`/`fetchChecklistItemRelationIds` (used by every
// lifecycle action, so Client/Enquiry/Project pages revalidate too), which
// read client_id/enquiry_id/project_id. The mock routes `.from("follow_ups")`
// by the requested columns so the two kinds of lookups stay independently
// assertable, matching two separate reads in the real implementation.
const nextDateResult: {
  data: { due_date: string; series: { recurrence_rule: string } | null } | null;
  error: { message: string } | null;
} = {
  data: { due_date: "2026-10-01", series: null },
  error: null,
};
const relationsResult: {
  data: { client_id: string | null; enquiry_id: string | null; project_id: string | null } | null;
  error: { message: string } | null;
} = {
  data: { client_id: clientId, enquiry_id: enquiryId, project_id: null },
  error: null,
};
const checklistRelationsResult: {
  data: {
    follow_ups: { client_id: string | null; enquiry_id: string | null; project_id: string | null };
  } | null;
  error: { message: string } | null;
} = {
  data: { follow_ups: { client_id: clientId, enquiry_id: enquiryId, project_id: null } },
  error: null,
};

const nextDateEq = vi.fn(() => ({ maybeSingle: () => Promise.resolve(nextDateResult) }));
const relationsEq = vi.fn(() => ({ maybeSingle: () => Promise.resolve(relationsResult) }));
const checklistRelationsEq = vi.fn(() => ({
  maybeSingle: () => Promise.resolve(checklistRelationsResult),
}));
const fromMock = vi.fn((table: string) => {
  if (table === "follow_ups") {
    return {
      select: (columns: string) => ({
        eq: columns.includes("due_date") ? nextDateEq : relationsEq,
      }),
    };
  }
  if (table === "follow_up_checklist_items") {
    return { select: () => ({ eq: checklistRelationsEq }) };
  }
  throw new Error(`unexpected table: ${table}`);
});

const followUpInput = {
  clientId,
  contactId: "",
  enquiryId,
  projectId: "",
  followUpType: "Client Check-in",
  customType: "",
  title: "Call client",
  overview: "",
  notes: "",
  dueDate: "2026-10-01",
  dueTime: "",
  priority: "Medium",
  contactMethods: ["Phone"],
  checklist: [{ label: "Confirm details", sortOrder: 0 }],
  recurrence: {
    enabled: false,
    frequency: "Weekly",
    intervalCount: 1,
    weekdays: [],
    monthAnchor: null,
    endsOn: "",
    maxOccurrences: null,
  },
  editScope: "occurrence",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOpsUser.mockResolvedValue({ id: "admin", name: "Neo", email: "neo@example.com" });
  mocks.createServer.mockResolvedValue({ rpc: mocks.rpc, from: fromMock });
  mocks.rpc.mockResolvedValue({ data: { status: "ok", follow_up_id: id }, error: null });
  mocks.createRecurrenceRule.mockReturnValue("");
  mocks.nextOccurrenceDate.mockReturnValue("2026-10-08");
  nextDateResult.data = { due_date: "2026-10-01", series: null };
  nextDateResult.error = null;
  relationsResult.data = { client_id: clientId, enquiry_id: enquiryId, project_id: null };
  relationsResult.error = null;
  checklistRelationsResult.data = {
    follow_ups: { client_id: clientId, enquiry_id: enquiryId, project_id: null },
  };
  checklistRelationsResult.error = null;
});

/** Exercises the shared not-found/conflict/invalid/error RPC-result mapping for one action. */
async function expectRpcResultMapping(run: () => Promise<FollowUpActionState>) {
  mocks.rpc.mockResolvedValueOnce({ data: { status: "not-found" }, error: null });
  await expect(run()).resolves.toEqual({
    status: "not-found",
    message: "That follow-up is no longer available.",
  });

  mocks.rpc.mockResolvedValueOnce({
    data: { status: "conflict", successor_id: successorId },
    error: null,
  });
  await expect(run()).resolves.toEqual({
    status: "conflict",
    message: "This follow-up changed elsewhere. Refresh and try again.",
    successorId,
  });

  mocks.rpc.mockResolvedValueOnce({
    data: { status: "invalid", message: "That change is not allowed." },
    error: null,
  });
  await expect(run()).resolves.toEqual({
    status: "invalid",
    message: "That change is not allowed.",
  });

  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "connection refused" } });
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await expect(run()).resolves.toEqual({ status: "error", message: FAILED });
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
}

describe("auth ordering", () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    ["createFollowUp", () => createFollowUp(followUpInput)],
    ["updateFollowUp", () => updateFollowUp(id, 1, followUpInput)],
    ["setFollowUpChecklistItem", () => setFollowUpChecklistItem(id, true, 1)],
    [
      "rescheduleFollowUp",
      () => rescheduleFollowUp(id, 1, { dueDate: "2026-10-02", dueTime: "", scope: "occurrence" }),
    ],
    ["completeFollowUp", () => completeFollowUp(id, 1, { outcome: "" })],
    [
      "cancelFollowUp",
      () => cancelFollowUp(id, 1, { reason: "No longer needed", scope: "series" }),
    ],
    ["reopenFollowUp", () => reopenFollowUp(id, 1)],
  ];

  it.each(cases)("%s checks auth before touching the database", async (_name, run) => {
    mocks.requireOpsUser.mockRejectedValueOnce(new Error("redirect"));
    await expect(run()).rejects.toThrow("redirect");
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("version validation", () => {
  const cases: Array<[string, (version: number) => Promise<FollowUpActionState>]> = [
    ["updateFollowUp", (version) => updateFollowUp(id, version, followUpInput)],
    ["setFollowUpChecklistItem", (version) => setFollowUpChecklistItem(id, true, version)],
    [
      "rescheduleFollowUp",
      (version) =>
        rescheduleFollowUp(id, version, {
          dueDate: "2026-10-02",
          dueTime: "",
          scope: "occurrence",
        }),
    ],
    ["completeFollowUp", (version) => completeFollowUp(id, version, { outcome: "" })],
    [
      "cancelFollowUp (occurrence)",
      (version) => cancelFollowUp(id, version, { reason: "Not needed", scope: "occurrence" }),
    ],
    [
      "cancelFollowUp (series)",
      (version) => cancelFollowUp(id, version, { reason: "Not needed", scope: "series" }),
    ],
    ["reopenFollowUp", (version) => reopenFollowUp(id, version)],
  ];
  // A server action's arguments come from the client, so the declared `number` type is not a
  // guarantee: anything that is not a positive integer must never reach the RPC, where a NULL
  // version used to skip the optimistic-lock check entirely.
  const badVersions: Array<[string, unknown]> = [
    ["NaN", Number.NaN],
    ["0", 0],
    ["a negative number", -1],
    ["a non-integer", 1.5],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["undefined", undefined],
    ["null", null],
    ["a numeric string", "1"],
  ];
  const matrix = cases.flatMap(([name, run]) =>
    badVersions.map(([label, version]) => [name, label, run, version] as const),
  );

  it.each(matrix)(
    "%s rejects %s as the version without touching the database",
    async (_name, _label, run, version) => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(run(version as number)).resolves.toEqual({ status: "error", message: FAILED });

      expect(mocks.requireOpsUser).toHaveBeenCalled();
      expect(mocks.createServer).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("invalid version"));
      spy.mockRestore();
    },
  );

  it.each(cases)("%s checks auth before validating the version", async (_name, run) => {
    mocks.requireOpsUser.mockRejectedValueOnce(new Error("redirect"));
    await expect(run(Number.NaN)).rejects.toThrow("redirect");
  });

  it.each(cases)("%s passes a valid positive integer version through", async (_name, run) => {
    await run(7);
    expect(mocks.rpc).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ p_version: 7 }),
    );
  });
});

describe("createFollowUp", () => {
  it("returns invalid without calling the database when input fails validation", async () => {
    await expect(createFollowUp({})).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("creates a follow-up with the owner snapshot, checklist, and recurrence payload", async () => {
    mocks.createRecurrenceRule.mockReturnValue("");

    const result = await createFollowUp(followUpInput);

    expect(result).toEqual({ status: "success", followUpId: id, successorId: undefined });
    expect(mocks.rpc).toHaveBeenCalledWith("create_follow_up", {
      p_follow_up: expect.objectContaining({
        client_id: clientId,
        contact_id: "",
        enquiry_id: enquiryId,
        project_id: "",
        follow_up_type: "Client Check-in",
        custom_type: "",
        title: "Call client",
        due_date: "2026-10-01",
        priority: "Medium",
        contact_methods: ["Phone"],
        owner_name: "Neo",
        owner_email: "neo@example.com",
      }),
      p_checklist: [expect.objectContaining({ label: "Confirm details", sort_order: 0 })],
      p_recurrence: expect.objectContaining({ enabled: false, recurrence_rule: "" }),
    });
    expect(mocks.createRecurrenceRule).toHaveBeenCalledWith(
      "2026-10-01",
      expect.objectContaining({ enabled: false }),
    );
  });

  it("revalidates the follow-ups list, detail, edit, and linked client/enquiry paths", async () => {
    await createFollowUp(followUpInput);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ops/follow-ups");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/follow-ups/${id}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/follow-ups/${id}/edit`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${clientId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/enquiries/${enquiryId}`);
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
      expect.stringContaining("/ops/projects/"),
    );
  });

  it("maps not-found/conflict/invalid RPC results and the generic failure message", async () => {
    await expectRpcResultMapping(() => createFollowUp(followUpInput));
  });
});

describe("updateFollowUp", () => {
  it("returns a not-found result without calling the database for a malformed id", async () => {
    await expect(updateFollowUp("not-a-uuid", 1, followUpInput)).resolves.toEqual(NOT_FOUND);
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns invalid without calling the database when input fails validation", async () => {
    await expect(updateFollowUp(id, 1, {})).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("updates the requested follow-up without an owner snapshot", async () => {
    await updateFollowUp(id, 3, followUpInput);

    expect(mocks.rpc).toHaveBeenCalledWith(
      "update_follow_up",
      expect.objectContaining({
        p_follow_up_id: id,
        p_scope: "occurrence",
        p_version: 3,
        p_follow_up: expect.not.objectContaining({ owner_name: expect.anything() }),
      }),
    );
    const call = mocks.rpc.mock.calls[0]!;
    expect(call[1].p_follow_up).not.toHaveProperty("owner_name");
    expect(call[1].p_follow_up).not.toHaveProperty("owner_email");
  });

  it("revalidates the new client/enquiry paths from the parsed input", async () => {
    await updateFollowUp(id, 3, followUpInput);

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${clientId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/enquiries/${enquiryId}`);
  });

  it("also revalidates the OLD client when the follow-up is relinked to a different client", async () => {
    relationsResult.data = { client_id: otherClientId, enquiry_id: null, project_id: null };

    await updateFollowUp(id, 3, followUpInput);

    expect(relationsEq).toHaveBeenCalledWith("id", id);
    // The pre-update relation fetch must happen before the RPC call, since
    // the row (and its current relations) could change underneath us once
    // the RPC commits.
    const relationsOrder = relationsEq.mock.invocationCallOrder[0]!;
    const rpcOrder = mocks.rpc.mock.invocationCallOrder[0]!;
    expect(relationsOrder).toBeLessThan(rpcOrder);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${otherClientId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${clientId}`);
  });

  it("maps not-found/conflict/invalid RPC results and the generic failure message", async () => {
    await expectRpcResultMapping(() => updateFollowUp(id, 1, followUpInput));
  });
});

describe("setFollowUpChecklistItem", () => {
  it("returns a not-found result without calling the database for a malformed id", async () => {
    await expect(setFollowUpChecklistItem("not-a-uuid", true, 1)).resolves.toEqual(NOT_FOUND);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("toggles the checklist item through the narrow RPC", async () => {
    const result = await setFollowUpChecklistItem(id, true, 2);

    expect(result).toEqual({ status: "success", followUpId: id, successorId: undefined });
    expect(mocks.rpc).toHaveBeenCalledWith("set_follow_up_checklist_item", {
      p_item_id: id,
      p_completed: true,
      p_version: 2,
    });
  });

  it("revalidates the checklist item's linked client/enquiry pages via the parent follow-up", async () => {
    await setFollowUpChecklistItem(id, true, 2);

    expect(checklistRelationsEq).toHaveBeenCalledWith("id", id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${clientId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/enquiries/${enquiryId}`);
  });

  it("skips relation revalidation (but still succeeds) when the relation lookup fails", async () => {
    checklistRelationsResult.data = null;
    checklistRelationsResult.error = { message: "connection refused" };

    const result = await setFollowUpChecklistItem(id, true, 2);

    expect(result).toEqual({ status: "success", followUpId: id, successorId: undefined });
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(expect.stringContaining("/ops/clients/"));
  });

  it("maps not-found/conflict/invalid RPC results and the generic failure message", async () => {
    await expectRpcResultMapping(() => setFollowUpChecklistItem(id, false, 1));
  });
});

describe("rescheduleFollowUp", () => {
  const rescheduleInput = { dueDate: "2026-10-10", dueTime: "09:00", scope: "occurrence" as const };

  it("returns a not-found result without calling the database for a malformed id", async () => {
    await expect(rescheduleFollowUp("not-a-uuid", 1, rescheduleInput)).resolves.toEqual(NOT_FOUND);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns invalid without calling the database when input fails validation", async () => {
    await expect(
      rescheduleFollowUp(id, 1, { dueDate: "not-a-date", dueTime: "", scope: "occurrence" }),
    ).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reschedules with a null due time when none is given", async () => {
    await rescheduleFollowUp(id, 5, { dueDate: "2026-10-10", dueTime: "", scope: "occurrence" });

    expect(mocks.rpc).toHaveBeenCalledWith("reschedule_follow_up", {
      p_follow_up_id: id,
      p_due_date: "2026-10-10",
      p_due_time: null,
      p_scope: "occurrence",
      p_recurrence: {},
      p_version: 5,
    });
  });

  it("reschedules with the given due time", async () => {
    await rescheduleFollowUp(id, 5, rescheduleInput);

    expect(mocks.rpc).toHaveBeenCalledWith(
      "reschedule_follow_up",
      expect.objectContaining({ p_due_time: "09:00", p_scope: "occurrence" }),
    );
  });

  it('rejects scope "future" without calling the database (reschedule is occurrence-only)', async () => {
    await expect(
      rescheduleFollowUp(id, 5, { dueDate: "2026-10-10", dueTime: "09:00", scope: "future" }),
    ).resolves.toMatchObject({ status: "invalid" });
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("revalidates the linked client/enquiry/project pages", async () => {
    relationsResult.data = { client_id: clientId, enquiry_id: null, project_id: "proj-1" };

    await rescheduleFollowUp(id, 5, rescheduleInput);

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${clientId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ops/projects/proj-1");
  });

  it("maps not-found/conflict/invalid RPC results and the generic failure message", async () => {
    await expectRpcResultMapping(() => rescheduleFollowUp(id, 1, rescheduleInput));
  });
});

describe("completeFollowUp", () => {
  it("returns a not-found result without touching the database for a malformed id", async () => {
    await expect(completeFollowUp("not-a-uuid", 1, { outcome: "" })).resolves.toEqual(NOT_FOUND);
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns invalid without touching the database when input fails validation", async () => {
    await expect(completeFollowUp(id, 1, { outcome: 123 })).resolves.toMatchObject({
      status: "invalid",
    });
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("looks up the next occurrence date before calling the RPC, even for a standalone follow-up", async () => {
    nextDateResult.data = { due_date: "2026-10-01", series: null };

    await completeFollowUp(id, 4, { outcome: "Done" });

    expect(nextDateEq).toHaveBeenCalledWith("id", id);
    expect(mocks.nextOccurrenceDate).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("complete_follow_up", {
      p_follow_up_id: id,
      p_outcome: "Done",
      p_next_due_date: null,
      p_version: 4,
    });
    const nextDateOrder = nextDateEq.mock.invocationCallOrder[0]!;
    const rpcOrder = mocks.rpc.mock.invocationCallOrder[0]!;
    expect(nextDateOrder).toBeLessThan(rpcOrder);
  });

  it("computes the successor date from the series recurrence rule before calling the RPC", async () => {
    nextDateResult.data = {
      due_date: "2026-10-01",
      series: { recurrence_rule: "RRULE:FREQ=WEEKLY" },
    };
    mocks.nextOccurrenceDate.mockReturnValue("2026-10-08");

    await completeFollowUp(id, 1, { outcome: "" });

    expect(mocks.nextOccurrenceDate).toHaveBeenCalledWith("2026-10-01", "RRULE:FREQ=WEEKLY");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "complete_follow_up",
      expect.objectContaining({ p_next_due_date: "2026-10-08" }),
    );
  });

  it("also revalidates the created successor", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { status: "ok", follow_up_id: id, successor_id: successorId },
      error: null,
    });

    await completeFollowUp(id, 1, { outcome: "" });

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/follow-ups/${successorId}`);
  });

  it("revalidates the linked client/enquiry pages", async () => {
    await completeFollowUp(id, 1, { outcome: "" });

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${clientId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/enquiries/${enquiryId}`);
  });

  it("aborts without calling the RPC when the next-occurrence lookup fails", async () => {
    // A transient read failure here must never be treated as "no next
    // occurrence" (which the RPC reasonably interprets as "series ended"),
    // or a flaky read at the wrong moment silently and permanently kills an
    // otherwise-active recurring series.
    nextDateResult.data = null;
    nextDateResult.error = { message: "connection refused" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(completeFollowUp(id, 4, { outcome: "Done" })).resolves.toEqual({
      status: "error",
      message: FAILED,
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("proceeds to call the RPC (not short-circuited) when the follow-up itself has vanished", async () => {
    // A genuinely missing row (the follow-up was deleted, or never existed)
    // is not a lookup failure - it must not be treated the same as the
    // error case above. It should reach the RPC call exactly as before this
    // fix, since the RPC's own lookup correctly reports not-found for it.
    nextDateResult.data = null;
    nextDateResult.error = null;
    mocks.rpc.mockResolvedValueOnce({ data: { status: "not-found" }, error: null });

    const result = await completeFollowUp(id, 4, { outcome: "Done" });

    expect(mocks.rpc).toHaveBeenCalledWith("complete_follow_up", {
      p_follow_up_id: id,
      p_outcome: "Done",
      p_next_due_date: null,
      p_version: 4,
    });
    expect(result).toEqual({
      status: "not-found",
      message: "That follow-up is no longer available.",
    });
  });

  it("maps not-found/conflict/invalid RPC results and the generic failure message", async () => {
    await expectRpcResultMapping(() => completeFollowUp(id, 1, { outcome: "" }));
  });
});

describe("cancelFollowUp", () => {
  it("returns a not-found result without touching the database for a malformed id", async () => {
    await expect(
      cancelFollowUp("not-a-uuid", 1, { reason: "Not needed", scope: "series" }),
    ).resolves.toEqual(NOT_FOUND);
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns invalid without touching the database when the reason is missing", async () => {
    await expect(cancelFollowUp(id, 1, { reason: "", scope: "series" })).resolves.toMatchObject({
      status: "invalid",
    });
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not look up the next occurrence date for a this-and-future cancellation", async () => {
    await cancelFollowUp(id, 2, { reason: "Client cancelled", scope: "series" });

    expect(nextDateEq).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_follow_up", {
      p_follow_up_id: id,
      p_reason: "Client cancelled",
      p_scope: "series",
      p_next_due_date: null,
      p_version: 2,
    });
  });

  it("still revalidates the linked client/enquiry pages for a this-and-future cancellation", async () => {
    await cancelFollowUp(id, 2, { reason: "Client cancelled", scope: "series" });

    expect(relationsEq).toHaveBeenCalledWith("id", id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${clientId}`);
  });

  it("looks up the next occurrence date before calling the RPC for a this-occurrence-only cancellation", async () => {
    nextDateResult.data = {
      due_date: "2026-10-01",
      series: { recurrence_rule: "RRULE:FREQ=WEEKLY" },
    };
    mocks.nextOccurrenceDate.mockReturnValue("2026-10-08");

    await cancelFollowUp(id, 2, { reason: "Rescheduling later", scope: "occurrence" });

    expect(nextDateEq).toHaveBeenCalledWith("id", id);
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_follow_up", {
      p_follow_up_id: id,
      p_reason: "Rescheduling later",
      p_scope: "occurrence",
      p_next_due_date: "2026-10-08",
      p_version: 2,
    });
    const nextDateOrder = nextDateEq.mock.invocationCallOrder[0]!;
    const rpcOrder = mocks.rpc.mock.invocationCallOrder[0]!;
    expect(nextDateOrder).toBeLessThan(rpcOrder);
  });

  it("aborts without calling the RPC when the next-occurrence lookup fails for an occurrence-scoped cancel", async () => {
    nextDateResult.data = null;
    nextDateResult.error = { message: "connection refused" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      cancelFollowUp(id, 2, { reason: "Rescheduling later", scope: "occurrence" }),
    ).resolves.toEqual({ status: "error", message: FAILED });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("proceeds to call the RPC (not short-circuited) when the follow-up itself has vanished", async () => {
    nextDateResult.data = null;
    nextDateResult.error = null;
    mocks.rpc.mockResolvedValueOnce({ data: { status: "not-found" }, error: null });

    const result = await cancelFollowUp(id, 2, {
      reason: "Rescheduling later",
      scope: "occurrence",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("cancel_follow_up", {
      p_follow_up_id: id,
      p_reason: "Rescheduling later",
      p_scope: "occurrence",
      p_next_due_date: null,
      p_version: 2,
    });
    expect(result).toEqual({
      status: "not-found",
      message: "That follow-up is no longer available.",
    });
  });

  it("maps not-found/conflict/invalid RPC results and the generic failure message", async () => {
    await expectRpcResultMapping(() =>
      cancelFollowUp(id, 1, { reason: "No longer needed", scope: "series" }),
    );
  });
});

describe("reopenFollowUp", () => {
  it("returns a not-found result without calling the database for a malformed id", async () => {
    await expect(reopenFollowUp("not-a-uuid", 1)).resolves.toEqual(NOT_FOUND);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reopens through the narrow RPC", async () => {
    await reopenFollowUp(id, 6);

    expect(mocks.rpc).toHaveBeenCalledWith("reopen_follow_up", {
      p_follow_up_id: id,
      p_version: 6,
    });
  });

  it("revalidates the linked client/enquiry pages", async () => {
    await reopenFollowUp(id, 6);

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/clients/${clientId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/ops/enquiries/${enquiryId}`);
  });

  it("maps not-found/conflict/invalid RPC results and the generic failure message", async () => {
    await expectRpcResultMapping(() => reopenFollowUp(id, 1));
  });
});
