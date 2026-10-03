import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FollowUpLifecycleControl,
  ReopenBlockedNote,
} from "@/features/follow-ups/components/follow-up-lifecycle-control";
import {
  FOLLOW_UP_ID,
  followUpDetail,
  recurringDetail,
  seriesOf,
  SUCCESSOR_ID,
} from "@/features/follow-ups/components/follow-up-test-data";
import type { FollowUpDetail } from "@/features/follow-ups/types";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  cancel: vi.fn(),
  reschedule: vi.fn(),
  reopen: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/features/follow-ups/actions", () => ({
  completeFollowUp: mocks.complete,
  cancelFollowUp: mocks.cancel,
  rescheduleFollowUp: mocks.reschedule,
  reopenFollowUp: mocks.reopen,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

const ok = { status: "success", followUpId: FOLLOW_UP_ID } as const;
let onDone = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  onDone = vi.fn();
  for (const mock of [mocks.complete, mocks.cancel, mocks.reschedule, mocks.reopen])
    mock.mockResolvedValue(ok);
});

function renderControl(followUp: FollowUpDetail = followUpDetail()) {
  return render(<FollowUpLifecycleControl followUp={followUp} onDone={onDone} />);
}

const closed = (overrides: Partial<FollowUpDetail> = {}) =>
  followUpDetail({
    status: "Completed",
    scheduleState: "Completed",
    completedAt: "2026-09-30T10:00:00Z",
    ...overrides,
  });

describe("available controls", () => {
  it("offers Mark Complete, Reschedule and Cancel for an Open follow-up, never Reopen", () => {
    renderControl();
    expect(screen.getByRole("button", { name: "Mark Complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel Follow-up" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
  });

  it.each([
    ["Completed", closed()],
    ["Cancelled", followUpDetail({ status: "Cancelled", scheduleState: "Cancelled" })],
  ])("offers only Reopen for a %s follow-up", (_label, followUp) => {
    renderControl(followUp);
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Complete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
  });

  it("explains why a recurring occurrence with a successor cannot be reopened and links to it", () => {
    const followUp = recurringDetail({ ...closed(), successorId: SUCCESSOR_ID });
    render(
      <>
        <FollowUpLifecycleControl followUp={followUp} onDone={onDone} />
        <ReopenBlockedNote followUp={followUp} />
      </>,
    );
    expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/can't be reopened because its series has already moved on/),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View next occurrence" });
    expect(link).toHaveAttribute("href", `/ops/follow-ups/${SUCCESSOR_ID}`);
    expect(link).toHaveAccessibleDescription(/can't be reopened/);
  });

  it("shows no reopen explanation when reopening is allowed", () => {
    render(<ReopenBlockedNote followUp={closed()} />);
    expect(screen.queryByText(/can't be reopened/)).not.toBeInTheDocument();
    render(<ReopenBlockedNote followUp={followUpDetail()} />);
    expect(screen.queryByText(/can't be reopened/)).not.toBeInTheDocument();
  });
});

describe("dialog focus management", () => {
  it("opens a labelled dialog with focus on the first field", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    const dialog = screen.getByRole("dialog", { name: "Mark follow-up complete" });
    expect(dialog).toHaveAccessibleDescription(/Completing/);
    expect(screen.getByLabelText("Outcome (optional)")).toHaveFocus();
  });

  it("closes on Escape and returns focus to the control that opened it", () => {
    renderControl();
    const trigger = screen.getByRole("button", { name: "Reschedule" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Reschedule follow-up" });
    expect(within(dialog).getByLabelText("New due date")).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes from the Close button and restores focus too", () => {
    renderControl();
    const trigger = screen.getByRole("button", { name: "Mark Complete" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps Tab inside the dialog in both directions", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    const dialog = screen.getByRole("dialog");
    const field = screen.getByLabelText("Outcome (optional)");
    const submit = screen.getByRole("button", { name: "Complete Follow-up" });
    submit.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(field).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(submit).toHaveFocus();
  });

  it("ignores Escape while a save is in flight", async () => {
    mocks.complete.mockReturnValue(new Promise(() => {}));
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Completing..." })).toBeDisabled(),
    );
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });
});

describe("Mark Complete", () => {
  it("sends the optional outcome with the follow-up id and version", async () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.change(screen.getByLabelText("Outcome (optional)"), {
      target: { value: "  Client approved the quote. " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mocks.complete).toHaveBeenCalledWith(FOLLOW_UP_ID, 4, {
      outcome: "Client approved the quote.",
    });
    expect(onDone).toHaveBeenCalledWith({
      message: "Follow-up marked complete.",
      successorId: undefined,
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("warns with the number of unfinished checklist items but still allows completion", async () => {
    renderControl(
      followUpDetail({
        checklist: [
          ...followUpDetail().checklist,
          {
            id: "item-3",
            label: "Update project status",
            sortOrder: 2,
            isCompleted: false,
            completedAt: null,
            version: 1,
          },
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(
      screen.getByText(
        "2 checklist items are not done yet. You can still complete this follow-up.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledOnce());
  });

  it("uses the singular for one unfinished item and shows no warning when all are done", () => {
    const { unmount } = renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(screen.getByText(/1 checklist item is not done yet/)).toBeInTheDocument();
    unmount();

    renderControl(
      followUpDetail({
        checklist: followUpDetail().checklist.map((item) => ({ ...item, isCompleted: true })),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(screen.queryByText(/not done yet/)).not.toBeInTheDocument();
  });

  it("reports the created next occurrence for a recurring follow-up", async () => {
    mocks.complete.mockResolvedValue({ ...ok, successorId: SUCCESSOR_ID });
    renderControl(recurringDetail());
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(screen.getByText(/Completing it creates the next occurrence/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        message: "Follow-up marked complete. The next occurrence has been created.",
        successorId: SUCCESSOR_ID,
      }),
    );
  });

  it("says the series has ended when a recurring completion creates no successor", async () => {
    renderControl(recurringDetail());
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "Follow-up marked complete. That was the last occurrence, so the series has ended.",
        }),
      ),
    );
  });

  it("blocks an over-long outcome before calling the action", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.change(screen.getByLabelText("Outcome (optional)"), {
      target: { value: "x".repeat(3001) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    expect(screen.getByLabelText("Outcome (optional)")).toHaveAccessibleDescription(
      /Keep the outcome under 3000 characters/,
    );
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("prevents a double submit while pending", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.complete.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    expect(mocks.complete).toHaveBeenCalledOnce();
    finish(ok);
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });
});

describe("shared result handling", () => {
  it("attaches server field errors to the right control", async () => {
    mocks.complete.mockResolvedValue({
      status: "invalid",
      message: "Check the highlighted details and try again.",
      fieldErrors: { outcome: ["Outcome is too long."] },
    });
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the highlighted details");
    expect(screen.getByLabelText("Outcome (optional)")).toHaveAccessibleDescription(
      /Outcome is too long\./,
    );
    expect(screen.getByLabelText("Outcome (optional)")).toBeInvalid();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("explains a conflict and refreshes the page data on request", async () => {
    mocks.complete.mockResolvedValue({
      status: "conflict",
      message: "This follow-up changed elsewhere. Refresh and try again.",
    });
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh follow-up" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("links back to the list when the follow-up has vanished", async () => {
    mocks.complete.mockResolvedValue({
      status: "not-found",
      message: "That follow-up is no longer available.",
    });
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer available");
    expect(screen.getByRole("link", { name: "Back to Follow-ups" })).toHaveAttribute(
      "href",
      "/ops/follow-ups",
    );
  });

  it("keeps the dialog open on an error and allows a retry", async () => {
    mocks.complete.mockResolvedValueOnce({ status: "error", message: "Please try again shortly." });
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.change(screen.getByLabelText("Outcome (optional)"), { target: { value: "Done" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again shortly.");
    expect(screen.getByLabelText("Outcome (optional)")).toHaveValue("Done");
    const retry = await screen.findByRole("button", { name: "Complete Follow-up" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });

  it("shows a calm message when the action throws", async () => {
    mocks.complete.mockRejectedValue(new Error("network"));
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Follow-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't complete that just now. Please try again.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("Reschedule", () => {
  it("shows the current due date and sends an occurrence-only reschedule", async () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    expect(screen.getByText("Currently due Wed, 30 Sep 2026, 11:00.")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: "2026-10-12" } });
    fireEvent.change(screen.getByLabelText("New due time (optional)"), {
      target: { value: "14:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save New Date" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mocks.reschedule).toHaveBeenCalledWith(FOLLOW_UP_ID, 4, {
      dueDate: "2026-10-12",
      dueTime: "14:30",
      scope: "occurrence",
    });
    expect(onDone).toHaveBeenCalledWith({
      message: "Follow-up rescheduled to Mon, 12 Oct 2026, 14:30.",
    });
  });

  it("requires a date before calling the action", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save New Date" }));
    expect(screen.getByLabelText("New due date")).toHaveAccessibleDescription(
      "Choose the new due date.",
    );
    expect(mocks.reschedule).not.toHaveBeenCalled();
  });

  it("rejects an unchanged date and time", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.click(screen.getByRole("button", { name: "Save New Date" }));
    expect(screen.getByLabelText("New due date")).toHaveAccessibleDescription(
      "Choose a different date or time.",
    );
    expect(mocks.reschedule).not.toHaveBeenCalled();
  });

  it("allows an all-day date by clearing the time", async () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New due time (optional)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save New Date" }));
    await waitFor(() => expect(mocks.reschedule).toHaveBeenCalled());
    expect(mocks.reschedule.mock.calls[0]![2]).toEqual({
      dueDate: "2026-09-30",
      dueTime: "",
      scope: "occurrence",
    });
  });

  it("offers no scope choice for a recurring follow-up and points to Edit instead", async () => {
    renderControl(recurringDetail());
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText(/moves only this occurrence/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save New Date" }));
    await waitFor(() => expect(mocks.reschedule).toHaveBeenCalled());
    expect(mocks.reschedule.mock.calls[0]![2]).toMatchObject({ scope: "occurrence" });
  });

  it("shows a server rejection and a conflict", async () => {
    mocks.reschedule.mockResolvedValueOnce({
      status: "invalid",
      message: "Follow-up cannot be rescheduled.",
    });
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save New Date" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot be rescheduled");
    mocks.reschedule.mockResolvedValueOnce({ status: "conflict", message: "Changed elsewhere." });
    fireEvent.click(await screen.findByRole("button", { name: "Save New Date" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Refresh follow-up" })).toBeInTheDocument(),
    );
  });
});

describe("Cancel", () => {
  it("requires a reason before calling the action", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Follow-up" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Cancellation" }));
    expect(screen.getByLabelText("Reason for cancelling")).toHaveAccessibleDescription(
      "Give a short reason for cancelling.",
    );
    expect(screen.getByLabelText("Reason for cancelling")).toBeInvalid();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("cancels a standalone follow-up with no scope choice", async () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Follow-up" }));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason for cancelling"), {
      target: { value: "Client went elsewhere" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Cancellation" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ message: "Follow-up cancelled." }));
    expect(mocks.cancel).toHaveBeenCalledWith(FOLLOW_UP_ID, 4, {
      reason: "Client went elsewhere",
      scope: "occurrence",
    });
  });

  it("defaults a recurring cancel to this occurrence only and links the created successor", async () => {
    mocks.cancel.mockResolvedValue({ ...ok, successorId: SUCCESSOR_ID });
    renderControl(recurringDetail());
    fireEvent.click(screen.getByRole("button", { name: "Cancel Follow-up" }));
    expect(
      screen.getByRole("radio", { name: "This occurrence only (skip it and continue the series)" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "This and future occurrences (end the series)" }),
    ).not.toBeChecked();
    fireEvent.change(screen.getByLabelText("Reason for cancelling"), {
      target: { value: "Skip this week" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Cancellation" }));
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        message: "Follow-up cancelled. The next occurrence has been created.",
        successorId: SUCCESSOR_ID,
      }),
    );
    expect(mocks.cancel.mock.calls[0]![2]).toEqual({
      reason: "Skip this week",
      scope: "occurrence",
    });
  });

  it("ends the series when cancelling this and future occurrences", async () => {
    renderControl(recurringDetail());
    fireEvent.click(screen.getByRole("button", { name: "Cancel Follow-up" }));
    fireEvent.click(
      screen.getByRole("radio", { name: "This and future occurrences (end the series)" }),
    );
    fireEvent.change(screen.getByLabelText("Reason for cancelling"), {
      target: { value: "Contract ended" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Cancellation" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mocks.cancel.mock.calls[0]![2]).toEqual({ reason: "Contract ended", scope: "series" });
    expect(onDone).toHaveBeenCalledWith({
      message: "Follow-up cancelled. The series has ended, so nothing repeats.",
    });
  });

  it("does not ask for a scope once the series has already ended", () => {
    renderControl(recurringDetail({ series: seriesOf({ active: false }) }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel Follow-up" }));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("shows a server error and keeps the typed reason", async () => {
    mocks.cancel.mockResolvedValue({ status: "error", message: "Please try again shortly." });
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Follow-up" }));
    fireEvent.change(screen.getByLabelText("Reason for cancelling"), { target: { value: "Nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Cancellation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again shortly.");
    expect(screen.getByLabelText("Reason for cancelling")).toHaveValue("Nope");
  });

  it("uses a clearly different label for the dismiss button", () => {
    renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Follow-up" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep Follow-up" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});

describe("Reopen", () => {
  it("reopens a Completed follow-up after confirmation", async () => {
    renderControl(closed());
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    const dialog = screen.getByRole("dialog", { name: "Reopen follow-up" });
    expect(within(dialog).getByRole("button", { name: "Reopen Follow-up" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reopen Follow-up" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ message: "Follow-up reopened." }));
    expect(mocks.reopen).toHaveBeenCalledWith(FOLLOW_UP_ID, 4);
  });

  it("links to the successor when the server reports one", async () => {
    mocks.reopen.mockResolvedValue({
      status: "conflict",
      message: "Open the current recurring occurrence instead.",
      successorId: SUCCESSOR_ID,
    });
    renderControl(closed());
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen Follow-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Open the current recurring");
    expect(
      within(screen.getByRole("alert")).getByRole("link", { name: "View next occurrence" }),
    ).toHaveAttribute("href", `/ops/follow-ups/${SUCCESSOR_ID}`);
  });

  it("shows a server error without closing", async () => {
    mocks.reopen.mockResolvedValue({ status: "error", message: "Please try again shortly." });
    renderControl(closed());
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen Follow-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again shortly.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
