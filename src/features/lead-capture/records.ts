// Turns validated form input into the database rows the Command Center
// already reads. The free-text `notes` / `application` formats and the status
// values are kept exactly as the legacy site wrote them, because the current
// admin displays and filters on them.

import type { BookingInput, ContactLeadInput, PartnershipInput } from "./schemas";

const dash = (value: string) => value || "-";

export type ClientRow = {
  id: string;
  name: string;
  type: "Company" | "Individual";
  contact: string;
  email: string;
  phone: string;
  status: "Lead";
  notes: string;
};

export function leadClientRow(
  id: string,
  fields: { name: string; email: string; phone: string; company: string; notes: string },
): ClientRow {
  return {
    id,
    name: fields.name,
    type: fields.company ? "Company" : "Individual",
    contact: fields.name,
    email: fields.email,
    phone: fields.phone,
    status: "Lead",
    notes: fields.notes,
  };
}

/** The database rejects activity messages over 200 characters. */
export function activityMessage(message: string): string {
  return message.length <= 200 ? message : `${message.slice(0, 197)}...`;
}

export function contactLead(input: ContactLeadInput, id: string) {
  const notes = [
    `Assistance needed: ${dash(input.assistance_needed)}`,
    `Project readiness: ${dash(input.project_readiness)}`,
    `Timeline: ${dash(input.timeline)}`,
    `Budget range: ${dash(input.budget_range)}`,
    `Message: ${dash(input.message)}`,
  ].join(" / ");

  return {
    client: leadClientRow(id, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      notes,
    }),
    activity: `New contact enquiry from ${input.name || "website visitor"}`,
  };
}

export function bookingRecords(input: BookingInput, clientId: string) {
  const client = leadClientRow(clientId, {
    name: input.client_name,
    email: input.client_email,
    phone: input.client_phone,
    company: input.company,
    notes: `Company: ${dash(input.company)}`,
  });

  const notes = [
    `Services: ${dash(input.services)}`,
    `Project details: ${dash(input.project_details)}`,
    `Date flexibility: ${dash(input.date_flexibility)}`,
    `Budget: ${dash(input.budget)}`,
  ].join(" / ");

  return {
    client,
    booking: {
      client: clientId,
      service: input.session_type || "Enquiry",
      date: input.preferred_date || null,
      start: input.preferred_time || "",
      location: input.session_location || "",
      type: "Enquiry",
      status: "Enquiry",
      deposit: "Not Requested",
      notes,
    },
    activity: `New booking enquiry from ${input.client_name || "website visitor"}`,
  };
}

export function partnershipRecords(input: PartnershipInput, clientId: string) {
  const client = leadClientRow(clientId, {
    name: input.contact_name,
    email: input.contact_email,
    phone: input.contact_phone,
    company: input.company,
    notes: `Industry: ${dash(input.industry)}`,
  });

  const application = [
    `Partnership type: ${dash(input.partnership_type)}`,
    `Focus areas: ${dash(input.focus)}`,
    `Brand goals: ${dash(input.brand_goals)}`,
    `Industry: ${dash(input.industry)}`,
    `Website/Instagram: ${dash(input.brand_link)}`,
    `Location: ${dash(input.brand_location)}`,
    `Content frequency: ${dash(input.content_frequency)}`,
    `Budget: ${dash(input.partner_budget)}`,
    // The legacy form collected the contact's role but never stored it.
    ...(input.contact_role ? [`Contact role: ${input.contact_role}`] : []),
  ].join(" / ");

  return {
    client,
    partnership: {
      client: clientId,
      company: input.company,
      contact: input.contact_name,
      application,
      status: "Applied",
    },
    activity: `New partnership application from ${input.company || input.contact_name || "website visitor"}`,
  };
}
