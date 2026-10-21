import { describe, expect, it } from "vitest";
import {
  invoiceInputSchema,
  paymentInputSchema,
  quoteInputSchema,
} from "@/features/invoices/schemas";

const clientId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const enquiryId = "33333333-3333-4333-8333-333333333333";
const projectId = "44444444-4444-4444-8444-444444444444";
const base = {
  clientId,
  contactId,
  enquiryId: "",
  projectId: "",
  title: "Portrait commission",
  overview: "A two-day editorial portrait commission.",
  discountAmount: "250",
  lineItems: [{ description: "Photography", quantity: "1", unitAmount: "5000" }],
};

describe("commercial document schemas", () => {
  it("accepts a ZAR quote with an explicit discount and retainer", () => {
    expect(
      quoteInputSchema.safeParse({
        ...base,
        services: ["Photography"],
        location: "Johannesburg",
        retainerPercentage: "50",
        terms: "Deposit confirms the booking.",
      }).success,
    ).toBe(true);
  });

  it("rejects a document linked to both an enquiry and project", () => {
    const result = invoiceInputSchema.safeParse({
      ...base,
      enquiryId,
      projectId,
      notes: "",
      billingType: "Standard",
      issueDate: "2026-10-20",
      dueDate: "2026-10-27",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a discount above the subtotal and an inverted date range", () => {
    const result = invoiceInputSchema.safeParse({
      ...base,
      discountAmount: "6000",
      notes: "",
      billingType: "Standard",
      issueDate: "2026-10-27",
      dueDate: "2026-10-20",
    });
    expect(result.success).toBe(false);
  });

  it("validates manual payment details", () => {
    expect(
      paymentInputSchema.safeParse({
        amount: "2500",
        paidOn: "2026-10-20",
        method: "Bank Transfer",
        reference: "INV-2026-0001",
        notes: "Deposit received",
      }).success,
    ).toBe(true);
    expect(
      paymentInputSchema.safeParse({
        amount: "0",
        paidOn: "",
        method: "Cheque",
        reference: "",
        notes: "",
      }).success,
    ).toBe(false);
  });
});
