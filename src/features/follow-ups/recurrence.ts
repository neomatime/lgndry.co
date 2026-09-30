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

function lastDayOfMonth(year: number, monthIndex: number) {
  // Day 0 of the following month is the last day of `monthIndex`.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Adds `months` to `date`, clamping to the target month's last day when
 * `anchorDay` doesn't exist there (e.g. day 31 in a 30-day month, or day 29
 * in a non-leap February) instead of skipping ahead to the next month that
 * happens to have that day.
 */
function addMonthsClamped(date: Date, months: number, anchorDay: number) {
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;
  const day = Math.min(anchorDay, lastDayOfMonth(year, monthIndex));
  return new Date(Date.UTC(year, monthIndex, day, 12));
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
    const parsed = RRule.fromString(rule);
    const { freq, interval, bymonthday, dtstart, until } = parsed.options;
    if (freq === Frequency.MONTHLY) {
      // rrule (and the RFC 5545 default it implements) skips any month that
      // doesn't have the anchor day, drifting Jan 31 -> Mar 31 -> May 31 and
      // silently omitting Feb/Apr. Compute the clamped sequence ourselves
      // instead: Jan 31 -> Feb 28/29 -> Mar 31 -> Apr 30 -> May 31.
      const anchorDay = bymonthday?.[0] ?? dtstart.getUTCDate();
      const candidate = addMonthsClamped(utcDate(currentDate), interval || 1, anchorDay);
      if (until && candidate.getTime() > until.getTime()) return null;
      return dateString(candidate);
    }
    const next = parsed.after(utcDate(currentDate), false);
    return next ? dateString(next) : null;
  } catch {
    return null;
  }
}

const FREQUENCY_PLURAL_UNIT: Record<RecurrenceFrequency, string> = {
  Daily: "days",
  Weekly: "weeks",
  Monthly: "months",
  Custom: "days",
};

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
        : `Every ${input.intervalCount} ${FREQUENCY_PLURAL_UNIT[input.frequency]}`;
  if (input.frequency === "Weekly" && input.weekdays.length) {
    text += ` on ${input.weekdays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ")}`;
  }
  if (input.frequency === "Monthly" && input.monthAnchor) text += ` on day ${input.monthAnchor}`;
  if (input.endsOn) text += ` until ${input.endsOn}`;
  else if (input.maxOccurrences) text += ` for ${input.maxOccurrences} occurrences`;
  return text;
}
