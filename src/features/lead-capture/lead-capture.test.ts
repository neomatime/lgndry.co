import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activityMessage,
  bookingRecords,
  contactLead,
  leadClientRow,
  partnershipRecords,
} from "@/features/lead-capture/records";
import {
  bookingSchema,
  contactLeadSchema,
  partnershipSchema,
} from "@/features/lead-capture/schemas";

// --- a recording stand-in for the Supabase server client -------------------
type Insert = { table: string; row: Record<string, unknown> };
const inserts: Insert[] = [];
let failTable: string | null = null;

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return { error: failTable === table ? { message: "boom" } : null };
      },
    }),
  }),
}));

const { submitBooking, submitContactLead, submitPartnership } =
  await import("@/features/lead-capture/actions");

beforeEach(() => {
  inserts.length = 0;
  failTable = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const contact = {
  assistance_needed: "Book a photography session",
  project_readiness: "Ready to book now",
  timeline: "This month",
  budget_range: "R15,000 - R35,000",
  message: "A shoot in Polokwane",
  name: "Thandi Nkosi",
  email: "thandi@example.com",
  phone: "0821234567",
  company: "",
};

const booking = {
  session_type: "Portrait Session",
  services: "Portraiture, Brand Photography",
  project_details: "Family portraits",
  preferred_date: "2026-10-12",
  preferred_time: "10:00",
  session_location: "Studio",
  date_flexibility: "Exact date only",
  client_name: "Thandi Nkosi",
  client_email: "thandi@example.com",
  client_phone: "0821234567",
  company: "Nkosi Co",
  budget: "R10,000 - R25,000",
};

const partnership = {
  partnership_type: "Creative Partnership",
  focus: "Ongoing Photography, Brand Storytelling",
  brand_goals: "Grow our lodge brand",
  company: "Bushveld Lodge",
  industry: "Hospitality",
  brand_link: "",
  brand_location: "Limpopo",
  content_frequency: "Monthly",
  contact_name: "Sipho Dlamini",
  contact_role: "Marketing lead",
  contact_email: "sipho@bushveld.example",
  contact_phone: "0831234567",
  partner_budget: "R10,000 - R25,000 / month",
};

describe("stored record formats (the Command Center reads these)", () => {
  it("contact enquiry: a Lead client whose notes carry the answers", () => {
    const { client, activity } = contactLead(contactLeadSchema.parse(contact), "id-1");
    expect(client).toEqual({
      id: "id-1",
      name: "Thandi Nkosi",
      type: "Individual",
      contact: "Thandi Nkosi",
      email: "thandi@example.com",
      phone: "0821234567",
      status: "Lead",
      notes:
        "Assistance needed: Book a photography session / Project readiness: Ready to book now / Timeline: This month / Budget range: R15,000 - R35,000 / Message: A shoot in Polokwane",
    });
    expect(activity).toBe("New contact enquiry from Thandi Nkosi");
  });

  it("a company name makes the lead a Company", () => {
    expect(
      leadClientRow("x", { name: "A", email: "a@b.co", phone: "1", company: "Acme", notes: "" })
        .type,
    ).toBe("Company");
  });

  it("booking: client row plus an Enquiry booking with the legacy notes format", () => {
    const { client, booking: row, activity } = bookingRecords(bookingSchema.parse(booking), "c-1");
    expect(client.notes).toBe("Company: Nkosi Co");
    expect(client.type).toBe("Company");
    expect(row).toEqual({
      client: "c-1",
      service: "Portrait Session",
      date: "2026-10-12",
      start: "10:00",
      location: "Studio",
      type: "Enquiry",
      status: "Enquiry",
      deposit: "Not Requested",
      notes:
        "Services: Portraiture, Brand Photography / Project details: Family portraits / Date flexibility: Exact date only / Budget: R10,000 - R25,000",
    });
    expect(activity).toBe("New booking enquiry from Thandi Nkosi");
  });

  it("booking with no date stores null, as before", () => {
    const parsed = bookingSchema.parse({ ...booking, preferred_date: "" });
    expect(bookingRecords(parsed, "c").booking.date).toBeNull();
  });

  it("partnership: an Applied application in the legacy format, now keeping the role too", () => {
    const {
      client,
      partnership: row,
      activity,
    } = partnershipRecords(partnershipSchema.parse(partnership), "c-2");
    expect(client.notes).toBe("Industry: Hospitality");
    expect(row.status).toBe("Applied");
    expect(row.application).toBe(
      "Partnership type: Creative Partnership / Focus areas: Ongoing Photography, Brand Storytelling / Brand goals: Grow our lodge brand / Industry: Hospitality / Website/Instagram: - / Location: Limpopo / Content frequency: Monthly / Budget: R10,000 - R25,000 / month / Contact role: Marketing lead",
    );
    expect(activity).toBe("New partnership application from Bushveld Lodge");
  });

  it("truncates activity messages to the database's 200-character limit", () => {
    expect(activityMessage("short")).toBe("short");
    const long = activityMessage("x".repeat(500));
    expect(long).toHaveLength(200);
    expect(long.endsWith("...")).toBe(true);
  });
});

describe("validation", () => {
  it("accepts a complete contact enquiry and rejects bad or missing fields", () => {
    expect(contactLeadSchema.safeParse(contact).success).toBe(true);
    expect(contactLeadSchema.safeParse({ ...contact, email: "nope" }).success).toBe(false);
    expect(contactLeadSchema.safeParse({ ...contact, name: "  " }).success).toBe(false);
    expect(contactLeadSchema.safeParse({ ...contact, message: "" }).success).toBe(false);
  });

  it("caps field lengths so a payload can't be used to stuff the database", () => {
    expect(contactLeadSchema.safeParse({ ...contact, message: "x".repeat(2001) }).success).toBe(
      false,
    );
    expect(bookingSchema.safeParse({ ...booking, project_details: "x".repeat(501) }).success).toBe(
      false,
    );
  });

  it("requires a real ISO date or none for a booking", () => {
    expect(bookingSchema.safeParse({ ...booking, preferred_date: "12/10/2026" }).success).toBe(
      false,
    );
    expect(bookingSchema.safeParse({ ...booking, preferred_date: "" }).success).toBe(true);
  });

  it("requires a service / focus area selection", () => {
    expect(bookingSchema.safeParse({ ...booking, services: "" }).success).toBe(false);
    expect(partnershipSchema.safeParse({ ...partnership, focus: "" }).success).toBe(false);
  });
});

describe("server actions", () => {
  it("contact: saves one Lead client and logs activity", async () => {
    expect(await submitContactLead(contact)).toEqual({ ok: true });
    expect(inserts.map((i) => i.table)).toEqual(["clients", "ops_activity_log"]);
    expect(inserts[0]?.row).toMatchObject({ status: "Lead", email: "thandi@example.com" });
  });

  it("booking: saves the client, then the booking, then activity — in that order", async () => {
    expect(await submitBooking(booking)).toEqual({ ok: true });
    expect(inserts.map((i) => i.table)).toEqual(["clients", "bookings", "ops_activity_log"]);
    const clientId = (inserts[0]?.row as { id: string }).id;
    expect((inserts[1]?.row as { client: string }).client).toBe(clientId);
  });

  it("partnership: saves the client, then the application, then activity", async () => {
    expect(await submitPartnership(partnership)).toEqual({ ok: true });
    expect(inserts.map((i) => i.table)).toEqual(["clients", "partnerships", "ops_activity_log"]);
  });

  it("rejects invalid input without touching the database", async () => {
    const result = await submitBooking({ ...booking, client_email: "not-an-email" });
    expect(result.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("rejects a non-object payload", async () => {
    expect((await submitContactLead("hello")).ok).toBe(false);
    expect((await submitContactLead(null)).ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("silently drops honeypot submissions: reports success, stores nothing", async () => {
    expect(await submitContactLead({ ...contact, hp_website: "http://spam.example" })).toEqual({
      ok: true,
    });
    expect(inserts).toHaveLength(0);
  });

  it("reports failure if the client can't be saved, and writes nothing further", async () => {
    failTable = "clients";
    const result = await submitBooking(booking);
    expect(result.ok).toBe(false);
    expect(inserts.map((i) => i.table)).toEqual(["clients"]);
  });

  it("reports failure if the booking row can't be saved", async () => {
    failTable = "bookings";
    expect((await submitBooking(booking)).ok).toBe(false);
  });

  it("does not fail the submission just because the activity log failed", async () => {
    failTable = "ops_activity_log";
    expect(await submitContactLead(contact)).toEqual({ ok: true });
  });
});
