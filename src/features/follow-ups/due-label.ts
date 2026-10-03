import { addDays, johannesburgDate } from "@/features/follow-ups/list-view-model";

/**
 * Display formatting for follow-up dates.
 *
 * Due dates are calendar dates (`YYYY-MM-DD`) with no zone, so they are formatted from
 * their own parts and never pass through the runtime's time zone. "Today", "Tomorrow" and
 * "Yesterday" are measured against Johannesburg's calendar day. Month and weekday names
 * come from fixed tables rather than `Intl`, so the server render and the browser can
 * never disagree about an abbreviation (a hydration-mismatch lesson from earlier modules).
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(date: string) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month: MONTHS[month - 1] ?? "", day, weekday: WEEKDAYS[weekday] ?? "" };
}

/** `Thu, 29 May 2026` */
export function formatCalendarDate(date: string) {
  const { weekday, day, month, year } = parts(date);
  return `${weekday}, ${day} ${month} ${year}`;
}

/** `Today, 11:00`, `Yesterday`, or `Thu, 29 May` (with the year when it is not this year). */
export function formatDueLabel(dueDate: string, dueTime: string, now: Date) {
  const today = johannesburgDate(now);
  let day: string;
  if (dueDate === today) day = "Today";
  else if (dueDate === addDays(today, 1)) day = "Tomorrow";
  else if (dueDate === addDays(today, -1)) day = "Yesterday";
  else {
    const { weekday, day: dayOfMonth, month, year } = parts(dueDate);
    day = `${weekday}, ${dayOfMonth} ${month}`;
    if (year !== parts(today).year) day += ` ${year}`;
  }
  return dueTime ? `${day}, ${dueTime.slice(0, 5)}` : day;
}

/** `Thu, 29 May 2026, 11:00` */
export function formatDueFull(dueDate: string, dueTime: string) {
  return dueTime
    ? `${formatCalendarDate(dueDate)}, ${dueTime.slice(0, 5)}`
    : formatCalendarDate(dueDate);
}

/** A timestamp (completion, cancellation) as its Johannesburg calendar date. */
export function formatJohannesburgDay(timestamp: string) {
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) return "";
  return formatCalendarDate(johannesburgDate(instant));
}
