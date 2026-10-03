import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChecklistEditor,
  MAX_CHECKLIST_ITEMS,
} from "@/features/follow-ups/components/checklist-editor";
import type { FollowUpChecklistInput } from "@/features/follow-ups/types";

const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const items = [
  { id: ID_A, label: "Send quote", sortOrder: 0 },
  { id: ID_B, label: "Confirm date", sortOrder: 1 },
];

function setup(
  initial: FollowUpChecklistInput[] = items,
  extra: Partial<React.ComponentProps<typeof ChecklistEditor>> = {},
) {
  const onChange = vi.fn();
  render(<ChecklistEditor items={initial} onChange={onChange} {...extra} />);
  return onChange;
}
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0];

describe("ChecklistEditor", () => {
  it("renders existing items as labelled inputs in order", () => {
    setup();
    expect(screen.getByLabelText("Checklist item 1")).toHaveValue("Send quote");
    expect(screen.getByLabelText("Checklist item 2")).toHaveValue("Confirm date");
    expect(screen.getByRole("list", { name: "Checklist items" })).toBeInTheDocument();
  });

  it("shows an empty state with no items", () => {
    setup([]);
    expect(screen.getByText("No checklist items yet.")).toBeInTheDocument();
  });

  it("adds trimmed items from the button and ignores blank drafts", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onChange).not.toHaveBeenCalled();
    const draft = screen.getByLabelText("Add checklist item");
    fireEvent.change(draft, { target: { value: "  Book venue  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(last(onChange)).toEqual([
      { id: ID_A, label: "Send quote", sortOrder: 0 },
      { id: ID_B, label: "Confirm date", sortOrder: 1 },
      { label: "Book venue", sortOrder: 2 },
    ]);
    expect(draft).toHaveValue("");
    expect(draft).toHaveFocus();
  });

  it("adds on Enter without submitting the surrounding form", () => {
    const onChange = vi.fn();
    render(
      <form>
        <ChecklistEditor items={[]} onChange={onChange} />
      </form>,
    );
    const draft = screen.getByLabelText("Add checklist item");
    fireEvent.change(draft, { target: { value: "Call back" } });
    // fireEvent returns false when the default action (form submit) was prevented.
    expect(fireEvent.keyDown(draft, { key: "Enter" })).toBe(false);
    expect(last(onChange)).toEqual([{ label: "Call back", sortOrder: 0 }]);
  });

  it("prevents Enter inside an item from submitting the form", () => {
    setup();
    expect(fireEvent.keyDown(screen.getByLabelText("Checklist item 1"), { key: "Enter" })).toBe(
      false,
    );
  });

  it("edits a label while keeping its id", () => {
    const onChange = setup();
    fireEvent.change(screen.getByLabelText("Checklist item 2"), {
      target: { value: "Confirm new date" },
    });
    expect(last(onChange)[1]).toEqual({ id: ID_B, label: "Confirm new date", sortOrder: 1 });
  });

  it("reorders with real buttons, renumbers sortOrder, and keeps focus in place", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("button", { name: "Move item 2 up" }));
    expect(last(onChange)).toEqual([
      { id: ID_B, label: "Confirm date", sortOrder: 0 },
      { id: ID_A, label: "Send quote", sortOrder: 1 },
    ]);
    expect(screen.getByLabelText("Checklist item 1")).toHaveValue("Confirm date");
    // Now at the top, so "up" is disabled and focus falls back to the item's own input.
    expect(screen.getByLabelText("Checklist item 1")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Move item 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move item 2 down" })).toBeDisabled();
  });

  it("removes an item and moves focus to a neighbour", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(last(onChange)).toEqual([{ id: ID_B, label: "Confirm date", sortOrder: 0 }]);
    expect(screen.getByLabelText("Checklist item 1")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(last(onChange)).toEqual([]);
    expect(screen.getByLabelText("Add checklist item")).toHaveFocus();
  });

  it("uses only native, naturally tabbable controls in reading order", () => {
    setup();
    const controls = [...document.querySelectorAll("input, button")];
    expect(controls.every((element) => !element.hasAttribute("tabindex"))).toBe(true);
    const names = controls.map(
      (element) =>
        element.getAttribute("aria-label") ??
        (element as HTMLInputElement).labels?.[0]?.textContent ??
        element.textContent,
    );
    expect(names).toEqual([
      "Checklist item 1",
      "Move item 1 up",
      "Move item 1 down",
      "Remove item 1",
      "Checklist item 2",
      "Move item 2 up",
      "Move item 2 down",
      "Remove item 2",
      "Add checklist item",
      "Add",
    ]);
  });

  it("shows item and list errors with associations", () => {
    setup(items, { itemErrors: { 1: ["This field is required."] }, listErrors: ["Too many."] });
    const input = screen.getByLabelText("Checklist item 2");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("This field is required.");
    expect(screen.getByLabelText("Checklist item 1")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("alert")).toHaveTextContent("Too many.");
  });

  it("stops adding at the item limit", () => {
    const many = Array.from({ length: MAX_CHECKLIST_ITEMS }, (_, index) => ({
      label: `Item ${index}`,
      sortOrder: index,
    }));
    setup(many);
    expect(screen.getByLabelText("Add checklist item")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByText(/up to 50 checklist items/)).toBeInTheDocument();
  });
});
