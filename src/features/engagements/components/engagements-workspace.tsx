"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ops/status-badge";
import type { BookingItem, EngagementData, PartnershipItem } from "../types";

type View = "bookings" | "partnerships" | "calendar";
const dateFormat = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeZone: "Africa/Johannesburg",
});
const monthFormat = new Intl.DateTimeFormat("en-ZA", {
  month: "long",
  year: "numeric",
  timeZone: "Africa/Johannesburg",
});
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseDate(value: string) {
  return new Date(`${value}T12:00:00+02:00`);
}
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function Empty({ children }: { children: string }) {
  return <p className="text-ink-muted py-16 text-center text-sm">{children}</p>;
}

function BookingRows({ rows }: { rows: BookingItem[] }) {
  if (!rows.length) return <Empty>No booking requests match this view.</Empty>;
  return (
    <div className="divide-line border-line divide-y border-y">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/ops/engagements/bookings/${row.id}`}
          className="hover:bg-surface-soft grid gap-2 px-3 py-3 text-sm transition-colors md:grid-cols-[1.5fr_1fr_1fr_0.8fr] md:items-center"
        >
          <div>
            <p className="font-medium">
              {row.client?.name ?? row.contact?.name ?? "Booking request"}
            </p>
            <p className="text-ink-muted">{row.service}</p>
          </div>
          <div>
            <p>{row.date ? dateFormat.format(parseDate(row.date)) : "Unscheduled"}</p>
            <p className="text-ink-muted">{row.start ?? "Time open"}</p>
          </div>
          <p className="text-ink-muted line-clamp-2">{row.location ?? "Location not supplied"}</p>
          <div className="md:justify-self-end">
            <StatusBadge status={row.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function PartnershipRows({ rows }: { rows: PartnershipItem[] }) {
  if (!rows.length) return <Empty>No partnership requests match this view.</Empty>;
  return (
    <div className="divide-line border-line divide-y border-y">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/ops/engagements/partnerships/${row.id}`}
          className="hover:bg-surface-soft grid gap-2 px-3 py-3 text-sm transition-colors md:grid-cols-[1.4fr_1fr_1.4fr_0.8fr] md:items-center"
        >
          <div>
            <p className="font-medium">{row.company}</p>
            <p className="text-ink-muted">{row.contact?.name ?? "Contact not linked"}</p>
          </div>
          <p>{row.partnershipType}</p>
          <p className="text-ink-muted line-clamp-2">
            {row.focusAreas.join(", ") || "Focus not supplied"}
          </p>
          <div className="md:justify-self-end">
            <StatusBadge status={row.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function CalendarView({ bookings, today }: { bookings: BookingItem[]; today: string }) {
  const [visibleMonth, setVisibleMonth] = useState(monthKey(parseDate(today)));
  const [year = new Date().getFullYear(), month = 1] = visibleMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((mondayOffset + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - mondayOffset + 1;
      return day > 0 && day <= daysInMonth ? day : null;
    },
  );
  const dated = bookings.filter((booking) => booking.date?.startsWith(visibleMonth));
  const byDay = new Map<number, BookingItem[]>();
  for (const booking of dated) {
    const day = Number(booking.date?.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), booking]);
  }
  const move = (amount: number) => {
    const next = new Date(year, month - 1 + amount, 1);
    setVisibleMonth(monthKey(next));
  };
  return (
    <section className="border-line border">
      <header className="border-line flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-medium">{monthFormat.format(first)}</h2>
          <p className="text-ink-muted text-sm">Tentative and confirmed LGNDRY.Co sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            className="border-line hover:bg-surface-soft grid size-9 place-items-center border"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setVisibleMonth(monthKey(parseDate(today)))}
            className="border-line hover:bg-surface-soft h-9 border px-3 text-sm"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="border-line hover:bg-surface-soft grid size-9 place-items-center border"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>
      <div className="border-line bg-surface-soft grid grid-cols-7 border-b">
        {dayNames.map((day) => (
          <div key={day} className="text-ink-muted px-1 py-2 text-center text-xs font-medium">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => (
          <div
            key={index}
            className="border-line min-h-24 border-r border-b p-1 last:border-r-0 sm:min-h-32 sm:p-2"
          >
            {day ? (
              <>
                <p
                  className={
                    today === `${visibleMonth}-${String(day).padStart(2, "0")}`
                      ? "bg-ink text-surface grid size-6 place-items-center rounded-full text-xs"
                      : "text-ink-muted text-xs"
                  }
                >
                  {day}
                </p>
                <div className="mt-1 space-y-1">
                  {(byDay.get(day) ?? []).slice(0, 3).map((booking) => {
                    const confirmed =
                      booking.status === "Confirmed" || booking.status === "Completed";
                    return (
                      <Link
                        key={booking.id}
                        href={`/ops/engagements/bookings/${booking.id}`}
                        title={`${booking.client?.name ?? booking.service}: ${confirmed ? "Confirmed" : "Tentative"}`}
                        className={
                          confirmed
                            ? "border-ink bg-surface-soft block border px-1 py-1 text-[10px] leading-tight sm:text-xs"
                            : "border-line-strong block border border-dashed px-1 py-1 text-[10px] leading-tight sm:text-xs"
                        }
                      >
                        <span className="hidden font-medium sm:block">
                          {booking.start ? `${booking.start} ` : ""}
                          {booking.client?.name ?? booking.service}
                        </span>
                        <span>{confirmed ? "Confirmed" : "Tentative"}</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>
      <footer className="text-ink-muted flex flex-wrap gap-5 p-3 text-xs">
        <span>
          <span className="border-ink bg-surface-soft mr-2 inline-block size-3 border" />
          Confirmed
        </span>
        <span>
          <span className="border-line-strong mr-2 inline-block size-3 border border-dashed" />
          Tentative
        </span>
      </footer>
    </section>
  );
}

export function EngagementsWorkspace({ data, today }: { data: EngagementData; today: string }) {
  const [view, setView] = useState<View>("bookings");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const bookingStatuses = [...new Set(data.bookings.map((item) => item.status))];
  const partnershipStatuses = [...new Set(data.partnerships.map((item) => item.status))];
  const bookings = useMemo(
    () =>
      data.bookings.filter((item) => {
        const haystack =
          `${item.client?.name} ${item.contact?.name} ${item.service} ${item.location}`.toLowerCase();
        return (
          (status === "All" || item.status === status) && haystack.includes(search.toLowerCase())
        );
      }),
    [data.bookings, search, status],
  );
  const partnerships = useMemo(
    () =>
      data.partnerships.filter((item) => {
        const haystack =
          `${item.company} ${item.contact?.name} ${item.partnershipType} ${item.focusAreas.join(" ")}`.toLowerCase();
        return (
          (status === "All" || item.status === status) && haystack.includes(search.toLowerCase())
        );
      }),
    [data.partnerships, search, status],
  );
  const selectView = (next: View) => {
    setView(next);
    setStatus("All");
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b">
        <div role="tablist" aria-label="Bookings and partnerships views" className="flex gap-1">
          {(["bookings", "partnerships", "calendar"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={view === item}
              onClick={() => selectView(item)}
              className={
                view === item
                  ? "border-ink border-b-2 px-3 py-2 text-sm font-medium capitalize"
                  : "text-ink-muted border-b-2 border-transparent px-3 py-2 text-sm capitalize"
              }
            >
              {item === "bookings" ? "Booking Requests" : item}
            </button>
          ))}
        </div>
        {view !== "calendar" ? (
          <div className="flex items-center gap-2 pb-2">
            <label className="border-line-strong flex h-9 items-center gap-2 border px-3">
              <Search className="text-ink-muted size-4" />
              <span className="sr-only">Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search records..."
                className="min-w-0 bg-transparent text-sm outline-none"
              />
            </label>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="border-line-strong h-9 border bg-transparent px-2 text-sm"
            >
              <option>All</option>
              {(view === "bookings" ? bookingStatuses : partnershipStatuses).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      {view === "bookings" ? <BookingRows rows={bookings} /> : null}
      {view === "partnerships" ? <PartnershipRows rows={partnerships} /> : null}
      {view === "calendar" ? <CalendarView bookings={data.bookings} today={today} /> : null}
    </div>
  );
}
