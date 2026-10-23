import "server-only";
import { cache } from "react";
import { fetchEngagements } from "./fetch-engagements";
import type { BookingItem, PartnershipItem } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result<T> = { status: "ok"; record: T } | { status: "not-found" } | { status: "error" };

export const fetchBookingDetail = cache(async (id: string): Promise<Result<BookingItem>> => {
  if (!UUID.test(id)) return { status: "not-found" };
  const data = await fetchEngagements();
  if (!data) return { status: "error" };
  const record = data.bookings.find((item) => item.id === id);
  return record ? { status: "ok", record } : { status: "not-found" };
});

export const fetchPartnershipDetail = cache(
  async (id: string): Promise<Result<PartnershipItem>> => {
    if (!UUID.test(id)) return { status: "not-found" };
    const data = await fetchEngagements();
    if (!data) return { status: "error" };
    const record = data.partnerships.find((item) => item.id === id);
    return record ? { status: "ok", record } : { status: "not-found" };
  },
);
