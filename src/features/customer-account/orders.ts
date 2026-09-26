/** The parts of an `orders` row the account pages read. */
export type AccountOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderLineItem[] | null;
  itemSummary: string;
  quantity: number;
  subtotal: number;
  grandTotal: number | null;
  deliveryMethod: string;
  deliveryAddress: string;
  deliveryCity: string;
  postalCode: string;
  notes: string | null;
  submittedAt: string;
  status: string;
  statusHistory: StatusEvent[] | null;
};

export type OrderLineItem = {
  title?: string;
  image?: string;
  size?: string;
  details?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
};

export type StatusEvent = { status: string; at: string };

/**
 * Columns a customer's own order query asks for. Deliberately not `*`: the
 * table also holds the studio's private `internalNotes`, which must never
 * reach a customer's browser.
 */
export const ACCOUNT_ORDER_COLUMNS = [
  "id",
  "orderNumber",
  "customerName",
  "customerEmail",
  "customerPhone",
  "items",
  "itemSummary",
  "quantity",
  "subtotal",
  "grandTotal",
  "deliveryMethod",
  "deliveryAddress",
  "deliveryCity",
  "postalCode",
  "notes",
  "submittedAt",
  "status",
  "statusHistory",
].join(",");

/** The stages shown on the tracker, which differ for collection and delivery. */
export function stepsFor(order: Pick<AccountOrder, "deliveryMethod">): string[] {
  return /collect/i.test(order.deliveryMethod || "")
    ? ["Confirmed", "Preparing", "Ready for Collection", "Completed"]
    : ["Confirmed", "Preparing", "Out for Delivery", "Completed"];
}

/** The order's recorded status changes; an order with none has one, its current status. */
export function historyFor(
  order: Pick<AccountOrder, "statusHistory" | "status" | "submittedAt">,
): StatusEvent[] {
  const history = Array.isArray(order.statusHistory) ? order.statusHistory.slice() : [];
  if (!history.length)
    history.push({ status: order.status || "New Request", at: order.submittedAt });
  return history;
}

export type TrackerStep = { name: string; state: "complete" | "current" | ""; at: string | null };

/** Stages before fulfilment starts; the tracker explains rather than shows progress. */
export const PRE_FULFILMENT = ["New", "New Request", "Contacted"];

/** One tracker step per stage: complete if it was reached, current if it is where the order is now. */
export function trackerSteps(order: AccountOrder): TrackerStep[] {
  const history = historyFor(order);
  const steps = stepsFor(order);
  const currentIndex = steps.indexOf(order.status);
  return steps.map((name, index) => {
    const event = history.filter((h) => h.status === name).pop();
    return {
      name,
      state: event ? "complete" : index === currentIndex ? "current" : "",
      at: event ? event.at : null,
    };
  });
}

/** When the order was cancelled, if it was. */
export function cancelledAt(order: AccountOrder): string | null {
  if (order.status !== "Cancelled") return null;
  return (
    historyFor(order)
      .filter((h) => h.status === "Cancelled")
      .pop()?.at ?? null
  );
}

/** The first item of an order, used for its picture and title in lists. */
export function firstItem(order: Pick<AccountOrder, "items">): OrderLineItem {
  return Array.isArray(order.items) ? (order.items[0] ?? {}) : {};
}

/** The total to show: the recorded grand total, or the subtotal for older orders. */
export function orderTotal(order: Pick<AccountOrder, "grandTotal" | "subtotal">): number {
  return order.grandTotal != null ? order.grandTotal : order.subtotal;
}
