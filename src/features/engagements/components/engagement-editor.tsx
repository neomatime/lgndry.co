"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  setBookingStatus,
  setPartnershipStatus,
  updateBooking,
  updatePartnership,
} from "../actions";
import {
  BOOKING_STATUSES,
  PARTNERSHIP_STATUSES,
  type BookingItem,
  type PartnershipItem,
} from "../types";

const inputClass =
  "border-line-strong h-10 w-full border bg-transparent px-3 text-sm outline-none focus:border-ink";
const labelClass = "flex flex-col gap-1 text-sm";
type BookingValues = {
  service: string;
  services: string;
  date: string;
  start: string;
  location: string;
  projectDetails: string;
  dateFlexibility: string;
  budgetRange: string;
};
type PartnershipValues = {
  partnershipType: string;
  focusAreas: string;
  brandGoals: string;
  industry: string;
  brandLink: string;
  brandLocation: string;
  contentFrequency: string;
  budgetRange: string;
};

export function EngagementEditor({ record }: { record: BookingItem | PartnershipItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(record.version);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(record.status);
  const [values, setValues] = useState<BookingValues | PartnershipValues>(
    record.kind === "booking"
      ? {
          service: record.service,
          services: record.services.join(", "),
          date: record.date ?? "",
          start: record.start ?? "",
          location: record.location ?? "",
          projectDetails: record.projectDetails ?? "",
          dateFlexibility: record.dateFlexibility ?? "",
          budgetRange: record.budgetRange ?? "",
        }
      : {
          partnershipType: record.partnershipType,
          focusAreas: record.focusAreas.join(", "),
          brandGoals: record.brandGoals ?? "",
          industry: record.industry ?? "",
          brandLink: record.brandLink ?? "",
          brandLocation: record.brandLocation ?? "",
          contentFrequency: record.contentFrequency ?? "",
          budgetRange: record.budgetRange ?? "",
        },
  );
  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const handleResult = (result: Awaited<ReturnType<typeof updateBooking>>) => {
    if (result.status === "success") {
      setVersion(result.version);
      setMessage("Saved.");
      router.refresh();
    } else setMessage(result.message);
  };
  const save = () =>
    startTransition(async () => {
      setMessage("");
      if (record.kind === "booking") {
        const v = values as BookingValues;
        handleResult(
          await updateBooking(record.id, {
            ...v,
            services: v.services
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            version,
          }),
        );
      } else {
        const v = values as PartnershipValues;
        handleResult(
          await updatePartnership(record.id, {
            ...v,
            focusAreas: v.focusAreas
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            version,
          }),
        );
      }
    });
  const changeStatus = () =>
    startTransition(async () => {
      const result =
        record.kind === "booking"
          ? await setBookingStatus(record.id, status, version)
          : await setPartnershipStatus(record.id, status, version);
      handleResult(result);
    });

  return (
    <div className="flex flex-col gap-5">
      <section className="border-line border p-5">
        <h2 className="font-medium">Workflow status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className={`${inputClass} w-auto`}
          >
            {(record.kind === "booking" ? BOOKING_STATUSES : PARTNERSHIP_STATUSES).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || status === record.status}
            onClick={changeStatus}
            className="bg-ink text-surface h-10 px-4 text-sm font-medium disabled:opacity-50"
          >
            Update status
          </button>
        </div>
      </section>
      <details className="border-line border" open>
        <summary className="cursor-pointer px-5 py-4 font-medium">Edit record</summary>
        <div className="border-line grid gap-4 border-t p-5 md:grid-cols-2">
          {record.kind === "booking" ? (
            <>
              <label className={labelClass}>
                Session type
                <input
                  className={inputClass}
                  value={(values as BookingValues).service}
                  onChange={(e) => set("service", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Services, comma separated
                <input
                  className={inputClass}
                  value={(values as BookingValues).services}
                  onChange={(e) => set("services", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Preferred date
                <input
                  type="date"
                  className={inputClass}
                  value={(values as BookingValues).date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Preferred time
                <input
                  className={inputClass}
                  value={(values as BookingValues).start}
                  onChange={(e) => set("start", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Location
                <input
                  className={inputClass}
                  value={(values as BookingValues).location}
                  onChange={(e) => set("location", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Date flexibility
                <input
                  className={inputClass}
                  value={(values as BookingValues).dateFlexibility}
                  onChange={(e) => set("dateFlexibility", e.target.value)}
                />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Project details
                <textarea
                  className="border-line-strong min-h-28 border bg-transparent p-3"
                  value={(values as BookingValues).projectDetails}
                  onChange={(e) => set("projectDetails", e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className={labelClass}>
                Partnership type
                <input
                  className={inputClass}
                  value={(values as PartnershipValues).partnershipType}
                  onChange={(e) => set("partnershipType", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Focus areas, comma separated
                <input
                  className={inputClass}
                  value={(values as PartnershipValues).focusAreas}
                  onChange={(e) => set("focusAreas", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Industry
                <input
                  className={inputClass}
                  value={(values as PartnershipValues).industry}
                  onChange={(e) => set("industry", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Brand location
                <input
                  className={inputClass}
                  value={(values as PartnershipValues).brandLocation}
                  onChange={(e) => set("brandLocation", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Brand link
                <input
                  className={inputClass}
                  value={(values as PartnershipValues).brandLink}
                  onChange={(e) => set("brandLink", e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Content frequency
                <input
                  className={inputClass}
                  value={(values as PartnershipValues).contentFrequency}
                  onChange={(e) => set("contentFrequency", e.target.value)}
                />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Brand goals
                <textarea
                  className="border-line-strong min-h-28 border bg-transparent p-3"
                  value={(values as PartnershipValues).brandGoals}
                  onChange={(e) => set("brandGoals", e.target.value)}
                />
              </label>
            </>
          )}
          <label className={labelClass}>
            Budget range
            <input
              className={inputClass}
              value={values.budgetRange}
              onChange={(e) => set("budgetRange", e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="bg-ink text-surface h-10 px-5 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save changes"}
            </button>
          </div>
          {message ? (
            <p className="text-ink-muted text-sm md:col-span-2" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
