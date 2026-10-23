import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";
import type { BookingItem, EngagementData, PartnershipItem } from "./types";

type RelatedRow = { id: string; name?: string; full_name?: string; email?: string; phone?: string };
const related = (row: RelatedRow | null | undefined) =>
  row
    ? {
        id: row.id,
        name: row.name ?? row.full_name ?? "Unknown",
        email: row.email ?? null,
        phone: row.phone ?? null,
      }
    : null;

export async function fetchEngagements(): Promise<EngagementData | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [bookingResult, partnershipResult] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, service, services, date, start, location, project_details, date_flexibility, budget_range, status, deposit, owner_name, owner_email, version, created_at, client:clients!bookings_client_fkey(id,name,email,phone), contact:client_contacts!bookings_client_contact_id_fkey(id,full_name,email,phone)",
        )
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("partnerships")
        .select(
          "id, company, partnership_type, focus_areas, brand_goals, industry, brand_link, brand_location, content_frequency, contact_role, contact_email, contact_phone, budget_range, status, owner_name, owner_email, version, created_at, client:clients!partnerships_client_fkey(id,name,email,phone), contact:client_contacts!partnerships_client_contact_id_fkey(id,full_name,email,phone)",
        )
        .eq("archived", false)
        .order("created_at", { ascending: false }),
    ]);
    if (bookingResult.error) throw bookingResult.error;
    if (partnershipResult.error) throw partnershipResult.error;

    const bookings = ((bookingResult.data ?? []) as unknown as Record<string, unknown>[]).map(
      (row) => ({
        kind: "booking" as const,
        id: String(row.id),
        client: related(row.client as RelatedRow | null),
        contact: related(row.contact as RelatedRow | null),
        service: String(row.service ?? "Booking request"),
        services: (row.services as string[] | null) ?? [],
        date: (row.date as string | null) ?? null,
        start: (row.start as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        projectDetails: (row.project_details as string | null) ?? null,
        dateFlexibility: (row.date_flexibility as string | null) ?? null,
        budgetRange: (row.budget_range as string | null) ?? null,
        status: row.status as BookingItem["status"],
        deposit: String(row.deposit ?? "Not Requested"),
        ownerName: (row.owner_name as string | null) ?? null,
        ownerEmail: (row.owner_email as string | null) ?? null,
        version: Number(row.version ?? 1),
        createdAt: String(row.created_at),
      }),
    );
    const partnerships = (
      (partnershipResult.data ?? []) as unknown as Record<string, unknown>[]
    ).map((row) => ({
      kind: "partnership" as const,
      id: String(row.id),
      client: related(row.client as RelatedRow | null),
      contact: related(row.contact as RelatedRow | null),
      company: String(
        row.company ?? (row.client as RelatedRow | null)?.name ?? "Partnership request",
      ),
      partnershipType: String(row.partnership_type ?? "Partnership"),
      focusAreas: (row.focus_areas as string[] | null) ?? [],
      brandGoals: (row.brand_goals as string | null) ?? null,
      industry: (row.industry as string | null) ?? null,
      brandLink: (row.brand_link as string | null) ?? null,
      brandLocation: (row.brand_location as string | null) ?? null,
      contentFrequency: (row.content_frequency as string | null) ?? null,
      contactRole: (row.contact_role as string | null) ?? null,
      budgetRange: (row.budget_range as string | null) ?? null,
      status: row.status as PartnershipItem["status"],
      ownerName: (row.owner_name as string | null) ?? null,
      ownerEmail: (row.owner_email as string | null) ?? null,
      version: Number(row.version ?? 1),
      createdAt: String(row.created_at),
    }));
    return { bookings, partnerships };
  } catch (error) {
    console.error("Could not load bookings and partnerships", error);
    return null;
  }
}
