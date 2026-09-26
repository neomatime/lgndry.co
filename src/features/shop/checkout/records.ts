import { activityMessage } from "@/features/lead-capture/records";
import {
  orderNumber,
  paymentStatusFor,
  type OrderItem,
  type OrderType,
} from "@/features/shop/checkout/order";
import type { PlaceOrderInput } from "@/features/shop/checkout/schema";

/** The `orders` row exactly as the legacy site wrote it (the current admin reads these fields). */
export type OrderRecord = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  itemSummary: string;
  quantity: number;
  subtotal: number;
  deliveryFee: number;
  grandTotal: number;
  orderType: OrderType;
  paymentMethod: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  deliveryMethod: string;
  deliveryAddress: string;
  deliveryCity: string;
  postalCode: string;
  billingName: string;
  billingAddress: string;
  billingCity: string;
  billingPostalCode: string;
  notes: string;
  submittedAt: string;
  status: string;
  customer_id?: string;
};

type Priced = {
  orderType: OrderType;
  items: OrderItem[];
  itemSummary: string;
  quantity: number;
  subtotal: number;
  deliveryFee: number;
  grandTotal: number;
};

/**
 * Builds the row to store. Collection orders keep placeholder address text and
 * blank billing details fall back to the delivery ones, as on the legacy site.
 * A signed-in, email-confirmed customer's own name and email win over what was
 * typed, and the order is linked to their account.
 */
export function orderRecord(
  input: PlaceOrderInput,
  priced: Priced,
  meta: {
    id: string;
    submittedAt: string;
    suffix: number;
    customer?: { id: string; email?: string | null; fullName?: string | null };
  },
): OrderRecord {
  const deliveryAddress = input.deliveryAddress || "Collection from LGNDRY.Co";
  const deliveryCity = input.deliveryCity || "Collection";
  const postalCode = input.postalCode || "N/A";
  const same = input.billingSame;
  const customerName = meta.customer?.fullName || input.customerName;

  return {
    id: meta.id,
    orderNumber: orderNumber(meta.submittedAt, meta.suffix),
    customerName,
    customerEmail: meta.customer?.email || input.customerEmail,
    customerPhone: input.customerPhone,
    items: priced.items,
    itemSummary: priced.itemSummary,
    quantity: priced.quantity,
    subtotal: priced.subtotal,
    deliveryFee: priced.deliveryFee,
    grandTotal: priced.grandTotal,
    orderType: priced.orderType,
    paymentMethod: input.paymentMethod,
    paymentStatus: paymentStatusFor(priced.orderType),
    fulfilmentStatus: "Awaiting Confirmation",
    deliveryMethod: input.deliveryMethod,
    deliveryAddress,
    deliveryCity,
    postalCode,
    billingName: (same ? input.customerName : input.billingName) || customerName,
    billingAddress: (same ? input.deliveryAddress : input.billingAddress) || deliveryAddress,
    billingCity: (same ? input.deliveryCity : input.billingCity) || deliveryCity,
    billingPostalCode: (same ? input.postalCode : input.billingPostalCode) || postalCode,
    notes: input.notes,
    submittedAt: meta.submittedAt,
    status: "New",
    ...(meta.customer ? { customer_id: meta.customer.id } : {}),
  };
}

export function orderActivity(
  order: Pick<OrderRecord, "orderType" | "orderNumber" | "customerName">,
) {
  return activityMessage(
    `New ${order.orderType.toLowerCase()} ${order.orderNumber} from ${order.customerName || "website visitor"}`,
  );
}
