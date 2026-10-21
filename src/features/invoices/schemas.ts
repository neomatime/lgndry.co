import { z } from "zod";
import { BILLING_TYPES, PAYMENT_METHODS } from "@/features/invoices/types";

const optionalUuid = z.union([z.literal(""), z.uuid()]).default("");
const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid ZAR amount.");
const date = z
  .string()
  .trim()
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "Choose a valid date.");

export const commercialLineItemSchema = z.object({
  description: z.string().trim().min(1, "Add a description.").max(500),
  quantity: money.refine((value) => Number(value) > 0, "Quantity must be greater than zero."),
  unitAmount: money,
});

const documentBase = z
  .object({
    clientId: z.uuid("Choose a client."),
    contactId: z.uuid("Choose a billing contact."),
    enquiryId: optionalUuid,
    projectId: optionalUuid,
    title: z.string().trim().min(1, "Add a title.").max(240),
    overview: z.string().trim().max(5000).default(""),
    discountAmount: money,
    lineItems: z.array(commercialLineItemSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    if (value.enquiryId && value.projectId) {
      context.addIssue({
        code: "custom",
        path: ["projectId"],
        message: "Link either an enquiry or a project, not both.",
      });
    }
    const subtotal = value.lineItems.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitAmount),
      0,
    );
    if (Number(value.discountAmount) > subtotal) {
      context.addIssue({
        code: "custom",
        path: ["discountAmount"],
        message: "Discount cannot exceed the subtotal.",
      });
    }
  });

export const quoteInputSchema = documentBase.and(
  z.object({
    services: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    location: z.string().trim().max(300).default(""),
    retainerPercentage: money.refine(
      (value) => Number(value) > 0 && Number(value) <= 100,
      "Retainer must be between 0 and 100%.",
    ),
    terms: z.string().trim().max(10000).default(""),
  }),
);

export const invoiceInputSchema = documentBase.and(
  z
    .object({
      notes: z.string().trim().max(5000).default(""),
      billingType: z.enum(BILLING_TYPES),
      issueDate: date,
      dueDate: date,
    })
    .superRefine((value, context) => {
      if (value.issueDate && value.dueDate && value.issueDate > value.dueDate) {
        context.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "Due date cannot be before the issue date.",
        });
      }
    }),
);

export const paymentInputSchema = z.object({
  amount: money.refine((value) => Number(value) > 0, "Amount must be greater than zero."),
  paidOn: date.refine(Boolean, "Choose the payment date."),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(1000).default(""),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
