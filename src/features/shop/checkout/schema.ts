import { z } from "zod";

// Server-side validation for checkout. The browser already enforces required
// fields; this is the check that can't be bypassed. Limits are generous: they
// exist to stop abuse, not to police content.

export const DELIVER = "Deliver to my address";
export const COLLECT = "Collect in person";
export const PAYMENT_METHODS = ["EFT", "Payment in person"] as const;

const optional = (max: number) => z.string().trim().max(max).default("");
const required = (max: number) => z.string().trim().min(1).max(max);
const email = z.string().trim().max(254).pipe(z.email());

const line = z.object({
  artworkId: z.string().trim().min(1).max(64),
  size: optional(120),
  framing: optional(160),
  quantity: z.number().int().min(1).max(99),
  requiresConfirmation: z.boolean().default(false),
});

export const placeOrderSchema = z
  .object({
    customerName: required(120),
    customerEmail: email,
    customerPhone: required(40),
    deliveryMethod: z.enum([DELIVER, COLLECT]),
    deliveryAddress: optional(200),
    deliveryCity: optional(120),
    postalCode: optional(20),
    billingSame: z.boolean(),
    billingName: optional(120),
    billingAddress: optional(200),
    billingCity: optional(120),
    billingPostalCode: optional(20),
    notes: optional(2000),
    paymentMethod: z.enum(PAYMENT_METHODS),
    requestOnly: z.boolean().default(false),
    lines: z.array(line).min(1).max(30),
    // Hidden field real visitors never see or fill; bots often do.
    hp_website: z.string().max(500).optional(),
  })
  .superRefine((order, ctx) => {
    const need = (ok: boolean, path: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message: "Required" });
    };
    if (order.deliveryMethod === DELIVER) {
      need(order.deliveryAddress !== "", "deliveryAddress");
      need(order.deliveryCity !== "", "deliveryCity");
      need(order.postalCode !== "", "postalCode");
    }
    if (!order.billingSame) {
      need(order.billingName !== "", "billingName");
      need(order.billingAddress !== "", "billingAddress");
      need(order.billingCity !== "", "billingCity");
      need(order.billingPostalCode !== "", "billingPostalCode");
    }
  });

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
