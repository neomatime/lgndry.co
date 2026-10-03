"use client";

import { useId } from "react";
import {
  RECURRENCE_FREQUENCIES,
  WEEKDAYS,
  type FollowUpRecurrenceInput,
  type RecurrenceFrequency,
} from "@/features/follow-ups/types";

const inputClass = "border-line-strong h-10 w-full border bg-white px-3 text-sm";
const FREQUENCY_UNIT: Record<RecurrenceFrequency, string> = {
  Daily: "day(s)",
  Weekly: "week(s)",
  Monthly: "month(s)",
  Custom: "day(s)",
};
export type EndMode = "never" | "date" | "count";

export const BLANK_RECURRENCE: FollowUpRecurrenceInput = {
  enabled: false,
  frequency: "Weekly",
  intervalCount: 1,
  weekdays: [],
  monthAnchor: null,
  endsOn: "",
  maxOccurrences: null,
};

/**
 * The shape actually submitted: a disabled rule is blank, and weekday /
 * month-anchor values that don't apply to the chosen frequency are dropped so
 * stale hidden state can never fail validation or reach the server.
 */
export function normalizeRecurrence(value: FollowUpRecurrenceInput): FollowUpRecurrenceInput {
  if (!value.enabled) return BLANK_RECURRENCE;
  return {
    ...value,
    weekdays: value.frequency === "Weekly" ? value.weekdays : [],
    monthAnchor: value.frequency === "Monthly" ? value.monthAnchor : null,
  };
}

type Props = {
  value: FollowUpRecurrenceInput;
  onChange: (next: FollowUpRecurrenceInput) => void;
  /** First due date; used only to suggest a sensible weekday / day of month. */
  dueDate?: string;
  /** Locks every control, e.g. for "this occurrence only" edits. */
  disabled?: boolean;
  disabledReason?: string;
  /**
   * The chosen end condition. Controlled by the parent because "On a date"
   * with no date yet cannot be told apart from "Never" by looking at `value`
   * alone, and the parent must validate it before saving.
   */
  endMode: EndMode;
  onEndModeChange: (mode: EndMode) => void;
  /** Messages keyed by recurrence field (`weekdays`, `endsOn`, ...). */
  errors?: Record<string, string[]>;
};

function dueDateParts(dueDate?: string) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const [year, month, day] = dueDate.split("-").map(Number) as [number, number, number];
  // Calendar arithmetic only: UTC avoids any local-timezone day shift.
  return { weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), day };
}

/** The end condition implied by a saved rule (used to initialise `endMode`). */
export function endModeOf(value: FollowUpRecurrenceInput): EndMode {
  if (value.endsOn) return "date";
  if (value.maxOccurrences !== null) return "count";
  return "never";
}

function Errors({ id, messages }: { id: string; messages?: string[] }) {
  return messages?.length ? (
    <p id={id} className="mt-1 text-xs font-medium">
      {messages.join(" ")}
    </p>
  ) : null;
}

/**
 * Recurrence rule controls. Produces the `FollowUpRecurrenceInput` shape the
 * follow-up schema validates: weekdays only apply to Weekly, the month anchor
 * to Monthly, and the series ends by date or by occurrence count, never both.
 */
export function RecurrenceEditor({
  value,
  onChange,
  endMode: mode,
  onEndModeChange,
  dueDate,
  disabled = false,
  disabledReason,
  errors = {},
}: Props) {
  const uid = useId();
  const patch = (next: Partial<FollowUpRecurrenceInput>) => onChange({ ...value, ...next });
  const parts = dueDateParts(dueDate);

  function chooseFrequency(frequency: RecurrenceFrequency) {
    patch({
      frequency,
      weekdays:
        frequency === "Weekly" && !value.weekdays.length && parts
          ? [parts.weekday]
          : value.weekdays,
      monthAnchor:
        frequency === "Monthly" && value.monthAnchor === null && parts
          ? parts.day
          : value.monthAnchor,
    });
  }

  function toggle(enabled: boolean) {
    if (!enabled) return patch({ enabled });
    onChange({
      ...value,
      enabled,
      weekdays:
        value.frequency === "Weekly" && !value.weekdays.length && parts
          ? [parts.weekday]
          : value.weekdays,
      monthAnchor:
        value.frequency === "Monthly" && value.monthAnchor === null && parts
          ? parts.day
          : value.monthAnchor,
    });
  }

  function chooseEnd(next: EndMode) {
    onEndModeChange(next);
    patch({
      endsOn: next === "date" ? value.endsOn : "",
      maxOccurrences: next === "count" ? (value.maxOccurrences ?? 2) : null,
    });
  }

  const describe = (key: string) => (errors[key]?.length ? `${uid}-${key}-error` : undefined);
  const invalid = (key: string) => (errors[key]?.length ? true : undefined);
  const weekdaysId = `${uid}-weekdays`;

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">Recurrence</legend>
      {disabled && disabledReason ? (
        <p className="text-ink-muted mb-4 text-sm">{disabledReason}</p>
      ) : null}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => toggle(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Repeat this follow-up</span>
          <span className="text-ink-muted block text-xs">
            Completing it creates the next occurrence automatically.
          </span>
        </span>
      </label>

      {value.enabled ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-frequency`} className="text-sm font-medium">
              Repeats
            </label>
            <select
              id={`${uid}-frequency`}
              value={value.frequency}
              onChange={(event) => chooseFrequency(event.target.value as RecurrenceFrequency)}
              className={inputClass}
            >
              {RECURRENCE_FREQUENCIES.map((frequency) => (
                <option key={frequency}>{frequency}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-interval`} className="text-sm font-medium">
              {`Every (${FREQUENCY_UNIT[value.frequency]})`}
            </label>
            <input
              id={`${uid}-interval`}
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={value.intervalCount || ""}
              aria-invalid={invalid("intervalCount")}
              aria-describedby={describe("intervalCount")}
              onChange={(event) =>
                patch({ intervalCount: event.target.value === "" ? 0 : Number(event.target.value) })
              }
              className={inputClass}
            />
            <Errors id={`${uid}-intervalCount-error`} messages={errors.intervalCount} />
          </div>

          {value.frequency === "Weekly" ? (
            <fieldset className="sm:col-span-2" aria-describedby={describe("weekdays")}>
              <legend className="text-sm font-medium">On these days</legend>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2" id={weekdaysId}>
                {WEEKDAYS.map((day) => (
                  <label key={day.value} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={day.label}
                      checked={value.weekdays.includes(day.value)}
                      onChange={(event) =>
                        patch({
                          weekdays: event.target.checked
                            ? [...value.weekdays, day.value]
                            : value.weekdays.filter((item) => item !== day.value),
                        })
                      }
                    />
                    <span aria-hidden="true">{day.short}</span>
                  </label>
                ))}
              </div>
              <Errors id={`${uid}-weekdays-error`} messages={errors.weekdays} />
            </fieldset>
          ) : null}

          {value.frequency === "Monthly" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-anchor`} className="text-sm font-medium">
                Day of the month
              </label>
              <select
                id={`${uid}-anchor`}
                value={value.monthAnchor ?? ""}
                aria-invalid={invalid("monthAnchor")}
                aria-describedby={describe("monthAnchor")}
                onChange={(event) =>
                  patch({ monthAnchor: event.target.value ? Number(event.target.value) : null })
                }
                className={inputClass}
              >
                <option value="">Choose a day</option>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <p className="text-ink-muted text-xs">Shorter months use their last day instead.</p>
              <Errors id={`${uid}-monthAnchor-error`} messages={errors.monthAnchor} />
            </div>
          ) : null}

          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium">Ends</legend>
            <div className="mt-2 flex flex-col gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${uid}-ends`}
                  checked={mode === "never"}
                  onChange={() => chooseEnd("never")}
                />
                Never
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`${uid}-ends`}
                    checked={mode === "date"}
                    onChange={() => chooseEnd("date")}
                  />
                  On a date
                </label>
                {mode === "date" ? (
                  <div>
                    <label htmlFor={`${uid}-ends-on`} className="sr-only">
                      End date
                    </label>
                    <input
                      id={`${uid}-ends-on`}
                      type="date"
                      value={value.endsOn}
                      aria-invalid={invalid("endsOn")}
                      aria-describedby={describe("endsOn")}
                      onChange={(event) => patch({ endsOn: event.target.value })}
                      className={`${inputClass} w-auto`}
                    />
                  </div>
                ) : null}
              </div>
              <Errors id={`${uid}-endsOn-error`} messages={errors.endsOn} />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`${uid}-ends`}
                    checked={mode === "count"}
                    onChange={() => chooseEnd("count")}
                  />
                  After a number of occurrences
                </label>
                {mode === "count" ? (
                  <div>
                    <label htmlFor={`${uid}-max`} className="sr-only">
                      Number of occurrences
                    </label>
                    <input
                      id={`${uid}-max`}
                      type="number"
                      inputMode="numeric"
                      min={2}
                      max={500}
                      value={value.maxOccurrences ?? ""}
                      aria-invalid={invalid("maxOccurrences")}
                      aria-describedby={describe("maxOccurrences")}
                      onChange={(event) =>
                        patch({
                          maxOccurrences:
                            event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                      className={`${inputClass} w-28`}
                    />
                  </div>
                ) : null}
              </div>
              <Errors id={`${uid}-maxOccurrences-error`} messages={errors.maxOccurrences} />
            </div>
          </fieldset>
        </div>
      ) : null}
    </fieldset>
  );
}
