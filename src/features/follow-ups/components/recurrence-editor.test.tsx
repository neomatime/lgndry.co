import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  BLANK_RECURRENCE,
  endModeOf,
  normalizeRecurrence,
  RecurrenceEditor,
} from "@/features/follow-ups/components/recurrence-editor";
import { recurrenceSchema } from "@/features/follow-ups/schemas";
import type { FollowUpRecurrenceInput } from "@/features/follow-ups/types";

// 2026-10-14 is a Wednesday.
function Harness({
  initial = BLANK_RECURRENCE,
  ...props
}: { initial?: FollowUpRecurrenceInput } & Partial<
  Omit<React.ComponentProps<typeof RecurrenceEditor>, "endMode" | "onEndModeChange">
>) {
  const [value, setValue] = useState(initial);
  const [endMode, setEndMode] = useState(() => endModeOf(initial));
  return (
    <>
      <RecurrenceEditor
        value={value}
        onChange={setValue}
        endMode={endMode}
        onEndModeChange={setEndMode}
        dueDate="2026-10-14"
        {...props}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}
const current = (): FollowUpRecurrenceInput => JSON.parse(screen.getByTestId("value").textContent!);
const enable = () => fireEvent.click(screen.getByLabelText(/Repeat this follow-up/));

describe("RecurrenceEditor", () => {
  it("hides every rule control until repetition is switched on", () => {
    render(<Harness />);
    expect(screen.getByLabelText(/Repeat this follow-up/)).not.toBeChecked();
    expect(screen.queryByLabelText("Repeats")).not.toBeInTheDocument();
    enable();
    expect(screen.getByLabelText("Repeats")).toBeInTheDocument();
    expect(current().enabled).toBe(true);
  });

  it("offers daily, weekly, monthly and custom frequencies", () => {
    render(<Harness />);
    enable();
    const options = [...screen.getByLabelText("Repeats").querySelectorAll("option")].map(
      (option) => option.textContent,
    );
    expect(options).toEqual(["Daily", "Weekly", "Monthly", "Custom"]);
  });

  it("weekly pre-selects the due weekday and lets days be toggled", () => {
    render(<Harness />);
    enable();
    expect(current()).toMatchObject({ frequency: "Weekly", weekdays: [3] });
    expect(screen.getByLabelText("Wednesday")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Friday"));
    fireEvent.click(screen.getByLabelText("Wednesday"));
    expect(current().weekdays).toEqual([5]);
    expect(recurrenceSchema.safeParse(current()).success).toBe(true);
  });

  it("an empty weekly selection fails the schema and shows the supplied error", () => {
    render(<Harness errors={{ weekdays: ["Choose at least one day."] }} />);
    enable();
    fireEvent.click(screen.getByLabelText("Wednesday"));
    expect(recurrenceSchema.safeParse(current()).success).toBe(false);
    expect(screen.getByText("Choose at least one day.")).toBeInTheDocument();
  });

  it("monthly shows a day-of-month picker defaulting to the due day", () => {
    render(<Harness initial={{ ...BLANK_RECURRENCE, enabled: true }} />);
    expect(screen.queryByLabelText("Day of the month")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Repeats"), { target: { value: "Monthly" } });
    expect(screen.queryByText("On these days")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Day of the month")).toHaveValue("14");
    expect(current()).toMatchObject({ frequency: "Monthly", monthAnchor: 14 });
    fireEvent.change(screen.getByLabelText("Day of the month"), { target: { value: "31" } });
    expect(current().monthAnchor).toBe(31);
  });

  it("labels the interval by frequency and treats Custom as every N days", () => {
    render(<Harness />);
    enable();
    expect(screen.getByLabelText("Every (week(s))")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Repeats"), { target: { value: "Custom" } });
    fireEvent.change(screen.getByLabelText("Every (day(s))"), { target: { value: "10" } });
    expect(current()).toMatchObject({ frequency: "Custom", intervalCount: 10 });
    expect(recurrenceSchema.safeParse(current()).success).toBe(true);
  });

  it("ends never, on a date, or after a count - never both", () => {
    render(<Harness />);
    enable();
    expect(screen.getByLabelText("Never")).toBeChecked();
    fireEvent.click(screen.getByLabelText("On a date"));
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-12-31" } });
    expect(current()).toMatchObject({ endsOn: "2026-12-31", maxOccurrences: null });
    fireEvent.click(screen.getByLabelText("After a number of occurrences"));
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Number of occurrences"), { target: { value: "6" } });
    expect(current()).toMatchObject({ endsOn: "", maxOccurrences: 6 });
    fireEvent.click(screen.getByLabelText("Never"));
    expect(current()).toMatchObject({ endsOn: "", maxOccurrences: null });
  });

  it("starts in the mode matching an existing rule", () => {
    render(<Harness initial={{ ...BLANK_RECURRENCE, enabled: true, maxOccurrences: 4 }} />);
    expect(screen.getByLabelText("After a number of occurrences")).toBeChecked();
    expect(screen.getByLabelText("Number of occurrences")).toHaveValue(4);
  });

  it("locks all controls when disabled and explains why", () => {
    render(
      <Harness
        initial={{ ...BLANK_RECURRENCE, enabled: true, weekdays: [1] }}
        disabled
        disabledReason="Rule is locked."
      />,
    );
    expect(screen.getByText("Rule is locked.")).toBeInTheDocument();
    for (const control of [
      screen.getByLabelText(/Repeat this follow-up/),
      screen.getByLabelText("Repeats"),
      screen.getByLabelText("Monday"),
      screen.getByLabelText("Never"),
    ])
      expect(control).toBeDisabled();
  });

  it("associates field errors with their controls", () => {
    render(
      <Harness
        initial={{ ...BLANK_RECURRENCE, enabled: true, maxOccurrences: 2 }}
        errors={{
          intervalCount: ["Enter a whole number from 1 to 365."],
          maxOccurrences: ["Enter a whole number from 2 to 500."],
        }}
      />,
    );
    expect(screen.getByLabelText("Every (week(s))")).toHaveAccessibleDescription(
      "Enter a whole number from 1 to 365.",
    );
    expect(screen.getByLabelText("Number of occurrences")).toHaveAttribute("aria-invalid", "true");
  });

  it("clearing the interval produces a value the schema rejects", () => {
    render(<Harness />);
    enable();
    fireEvent.change(screen.getByLabelText("Every (week(s))"), { target: { value: "" } });
    expect(current().intervalCount).toBe(0);
    expect(recurrenceSchema.safeParse(current()).success).toBe(false);
  });
});

describe("endModeOf", () => {
  it("derives the end condition implied by a saved rule", () => {
    expect(endModeOf(BLANK_RECURRENCE)).toBe("never");
    expect(endModeOf({ ...BLANK_RECURRENCE, endsOn: "2026-12-01" })).toBe("date");
    expect(endModeOf({ ...BLANK_RECURRENCE, maxOccurrences: 5 })).toBe("count");
  });
});

describe("normalizeRecurrence", () => {
  it("blanks a disabled rule", () => {
    expect(
      normalizeRecurrence({ ...BLANK_RECURRENCE, intervalCount: 0, endsOn: "2020-01-01" }),
    ).toEqual(BLANK_RECURRENCE);
  });

  it("drops weekday and month-anchor leftovers that do not apply", () => {
    const base = { ...BLANK_RECURRENCE, enabled: true, weekdays: [1, 2], monthAnchor: 5 };
    expect(normalizeRecurrence({ ...base, frequency: "Daily" })).toMatchObject({
      weekdays: [],
      monthAnchor: null,
    });
    expect(normalizeRecurrence({ ...base, frequency: "Weekly" })).toMatchObject({
      weekdays: [1, 2],
      monthAnchor: null,
    });
    expect(normalizeRecurrence({ ...base, frequency: "Monthly" })).toMatchObject({
      weekdays: [],
      monthAnchor: 5,
    });
  });
});
