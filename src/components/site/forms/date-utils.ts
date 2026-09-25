// Calendar maths for the themed date picker. Pure and DOM-free so it can be
// unit-tested. Dates are handled as local-time calendar days, never as instants,
// so a picked day can't shift by one across time zones.

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses "YYYY-MM-DD" to a local date, or null for anything malformed. */
export function parseISO(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // Reject overflow like 2026-02-31 rolling into March.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** "Jan 5, 2026" — what the field shows. */
export function formatDisplay(date: Date | null): string {
  if (!date) return "";
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export type Cell =
  | { muted: true; label: number }
  | { muted: false; label: number; iso: string; isToday: boolean; isSelected: boolean };

/** The month grid: leading/trailing days from adjacent months are muted, week starts Sunday. */
export function buildCells(view: Date, selectedIso: string, today: Date = new Date()): Cell[] {
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayIso = toISO(today);
  const cells: Cell[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ muted: true, label: daysInPrevMonth - firstWeekday + i + 1 });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
    cells.push({
      muted: false,
      label: day,
      iso,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
    });
  }
  const remainder = cells.length % 7;
  const trailing = remainder === 0 ? 0 : 7 - remainder;
  for (let i = 1; i <= trailing; i++) cells.push({ muted: true, label: i });
  return cells;
}

export function addMonths(view: Date, delta: number): Date {
  return new Date(view.getFullYear(), view.getMonth() + delta, 1);
}
