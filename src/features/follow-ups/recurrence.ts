import { Frequency, RRule, Weekday } from "rrule";
import type { FollowUpRecurrenceInput, RecurrenceFrequency } from "@/features/follow-ups/types";

const RRULE_WEEKDAYS: Record<number, Weekday> = {
  0: RRule.SU,
  1: RRule.MO,
  2: RRule.TU,
  3: RRule.WE,
  4: RRule.TH,
  5: RRule.FR,
  6: RRule.SA,
};

function utcDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, 12));
}

function dateString(value: Date) {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function frequency(value: RecurrenceFrequency) {
  if (value === "Daily") return Frequency.DAILY;
  if (value === "Weekly") return Frequency.WEEKLY;
  if (value === "Monthly") return Frequency.MONTHLY;
  return Frequency.DAILY;
}

export function createRecurrenceRule(startDate: string, input: FollowUpRecurrenceInput) {
  if (!input.enabled) return "";
  const options = {
    freq: frequency(input.frequency),
    interval: input.intervalCount,
    dtstart: utcDate(startDate),
    ...(input.frequency === "Weekly"
      ? { byweekday: input.weekdays.map((day) => RRULE_WEEKDAYS[day]!) }
      : {}),
    ...(input.frequency === "Monthly" && input.monthAnchor
      ? { bymonthday: input.monthAnchor }
      : {}),
    ...(input.endsOn ? { until: utcDate(input.endsOn) } : {}),
    ...(input.maxOccurrences ? { count: input.maxOccurrences } : {}),
  };
  return new RRule(options).toString();
}

export function nextOccurrenceDate(currentDate: string, rule: string) {
  if (!rule) return null;
  try {
    const next = RRule.fromString(rule).after(utcDate(currentDate), false);
    return next ? dateString(next) : null;
  } catch {
    return null;
  }
}

export function recurrenceSummary(
  input: Pick<
    FollowUpRecurrenceInput,
    | "enabled"
    | "frequency"
    | "intervalCount"
    | "weekdays"
    | "monthAnchor"
    | "endsOn"
    | "maxOccurrences"
  >,
) {
  if (!input.enabled) return "Does not repeat";
  let text =
    input.frequency === "Custom"
      ? `Every ${input.intervalCount} days`
      : input.intervalCount === 1
        ? input.frequency
        : `Every ${input.intervalCount} ${input.frequency.toLowerCase().replace(/ly$/, "")}s`;
  if (input.frequency === "Weekly" && input.weekdays.length) {
    text += ` on ${input.weekdays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ")}`;
  }
  if (input.frequency === "Monthly" && input.monthAnchor) text += ` on day ${input.monthAnchor}`;
  if (input.endsOn) text += ` until ${input.endsOn}`;
  else if (input.maxOccurrences) text += ` for ${input.maxOccurrences} occurrences`;
  return text;
}
