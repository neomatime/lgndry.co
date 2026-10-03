import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowUpChecklist } from "@/features/follow-ups/components/follow-up-checklist";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";

const mocks = vi.hoisted(() => ({ toggle: vi.fn(), refresh: vi.fn() }));
vi.mock("@/features/follow-ups/actions", () => ({ setFollowUpChecklistItem: mocks.toggle }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

const items = followUpDetail().checklist;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.toggle.mockResolvedValue({ status: "success", followUpId: "fu-1" });
});

describe("FollowUpChecklist", () => {
  it("renders labelled checkboxes with progress and Johannesburg completion time", () => {
    render(<FollowUpChecklist items={items} editable />);
    expect(screen.getByRole("checkbox", { name: /Review quote summary/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Confirm client feedback/ })).not.toBeChecked();
    expect(screen.getByText("1 of 2 completed (50%)")).toBeInTheDocument();
    // 22:30 UTC is already 00:30 the next day in Johannesburg.
    expect(screen.getByText("Completed Wed, 30 Sep 2026, 00:30")).toBeInTheDocument();
  });

  it("saves a toggle against the item's own version and refreshes the page data", async () => {
    render(<FollowUpChecklist items={items} editable />);
    const box = screen.getByRole("checkbox", { name: /Confirm client feedback/ });
    fireEvent.click(box);
    expect(mocks.toggle).toHaveBeenCalledWith("item-2", true, 1);
    expect(box).toBeChecked();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(screen.getByText("2 of 2 completed (100%)")).toBeInTheDocument();
  });

  it("reopens a completed item", async () => {
    render(<FollowUpChecklist items={items} editable />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Review quote summary/ }));
    expect(mocks.toggle).toHaveBeenCalledWith("item-1", false, 2);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("disables the checkboxes while a save is in flight", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.toggle.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<FollowUpChecklist items={items} editable />);
    const box = screen.getByRole("checkbox", { name: /Confirm client feedback/ });
    fireEvent.click(box);
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("checkbox", { name: /Review quote summary/ })).toBeDisabled();
    fireEvent.click(box);
    expect(mocks.toggle).toHaveBeenCalledOnce();
    finish({ status: "success", followUpId: "fu-1" });
    await waitFor(() => expect(box).toBeEnabled());
  });

  it("explains a conflict calmly, reverts the item and offers a refresh path", async () => {
    mocks.toggle.mockResolvedValue({ status: "conflict", message: "Checklist changed elsewhere." });
    render(<FollowUpChecklist items={items} editable />);
    const box = screen.getByRole("checkbox", { name: /Confirm client feedback/ });
    fireEvent.click(box);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "This checklist changed elsewhere. Refresh to see the latest items.",
    );
    expect(box).not.toBeChecked();
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh checklist" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([
    [{ status: "error", message: "Please try again shortly." }, "Please try again shortly."],
    [{ status: "not-found", message: "That follow-up is no longer available." }, "no longer"],
    [{ status: "invalid", message: "Follow-up is no longer open." }, "no longer open"],
  ])("shows %j as a message and reverts the item", async (result, text) => {
    mocks.toggle.mockResolvedValue(result);
    render(<FollowUpChecklist items={items} editable />);
    const box = screen.getByRole("checkbox", { name: /Confirm client feedback/ });
    fireEvent.click(box);
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(box).not.toBeChecked();
    expect(box).toBeEnabled();
  });

  it("shows a calm message when the action throws", async () => {
    mocks.toggle.mockRejectedValue(new Error("network"));
    render(<FollowUpChecklist items={items} editable />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Confirm client feedback/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't update that item just now. Please try again.",
    );
  });

  it("is a read-only list when the follow-up is not open", () => {
    render(<FollowUpChecklist items={items} editable={false} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(/Review quote summary/)).toBeInTheDocument();
    expect(screen.getByText("(done)")).toBeInTheDocument();
    expect(screen.getByText("(not done)")).toBeInTheDocument();
  });

  it("says so when there are no items", () => {
    render(<FollowUpChecklist items={[]} editable />);
    expect(screen.getByText("No checklist items.")).toBeInTheDocument();
  });
});
