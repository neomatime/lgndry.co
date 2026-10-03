import { formatCalendarDate } from "@/features/follow-ups/due-label";
import { johannesburgDate } from "@/features/follow-ups/list-view-model";

/**
 * `Thu, 29 May 2026, 11:00` for a real instant (completion, cancellation, activity),
 * always read in Africa/Johannesburg - never the server's or the browser's zone. The date
 * reuses the fixed month/weekday tables; only the digits of the time come from `Intl`.
 */
export function formatJohannesburgTimestamp(timestamp: string) {
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) return "";
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return `${formatCalendarDate(johannesburgDate(instant))}, ${time}`;
}
