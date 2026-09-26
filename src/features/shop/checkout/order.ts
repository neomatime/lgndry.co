import { deliveryFee, itemFromProduct, type CartItem } from "@/features/shop/cart/cart-storage";
import { isAvailable, type Artwork } from "@/features/shop/catalogue/artwork";

export type OrderType = "Direct Purchase" | "Order Request";

/** What the browser sends for each cart line: which work and the choices made, never a price. */
export type RequestedLine = {
  artworkId: string;
  size: string;
  framing: string;
  quantity: number;
  requiresConfirmation: boolean;
};

/** A line as stored on the order: the cart line plus the unit price and line total. */
export type OrderItem = CartItem & { unitPrice: number; lineTotal: number };

export type PricedOrder =
  | {
      ok: true;
      orderType: OrderType;
      items: OrderItem[];
      itemSummary: string;
      quantity: number;
      subtotal: number;
      deliveryFee: number;
      grandTotal: number;
    }
  | { ok: false; error: string };

/**
 * Prices an order from the collection as it is now. Titles, prices and stock
 * come from the database; only the visitor's choices (size, framing, quantity)
 * are taken from the browser. A direct purchase needs every work to be
 * available with enough left; an order request accepts any work, one unit at
 * least, so the studio can follow up on reserved or sold-out pieces.
 */
export function priceOrder(input: {
  lines: RequestedLine[];
  products: Artwork[];
  /** The visitor arrived via "Send Order Request". */
  requestOnly: boolean;
  deliveryMethod: string;
}): PricedOrder {
  const byId = new Map(input.products.map((product) => [product.id, product]));
  const resolved: { product: Artwork; line: RequestedLine }[] = [];
  for (const line of input.lines) {
    const product = byId.get(line.artworkId);
    if (!product) {
      return {
        ok: false,
        error: "A work in your cart is no longer in the collection. Please review your cart.",
      };
    }
    resolved.push({ product, line });
  }

  const isRequest =
    input.requestOnly ||
    resolved.some(({ product, line }) => line.requiresConfirmation || product.requiresConfirmation);
  const orderType: OrderType = isRequest ? "Order Request" : "Direct Purchase";

  const items: OrderItem[] = [];
  for (const { product, line } of resolved) {
    if (!isRequest) {
      if (!isAvailable(product)) {
        return {
          ok: false,
          error: `${product.title} is no longer available to buy directly. Please send an order request instead.`,
        };
      }
      if (line.quantity > product.remaining) {
        return {
          ok: false,
          error: `Only ${product.remaining} of ${product.title} remain. Please update your cart.`,
        };
      }
    }
    const quantity = Math.min(line.quantity, Math.max(1, product.remaining));
    const item = itemFromProduct(product, {
      size: line.size,
      framing: line.framing,
      quantity,
    });
    items.push({
      ...item,
      requiresConfirmation: product.requiresConfirmation || line.requiresConfirmation,
      unitPrice: product.price,
      lineTotal: product.price * quantity,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  const fee = deliveryFee(input.deliveryMethod, items);
  return {
    ok: true,
    orderType,
    items,
    itemSummary: items
      .map((item) => `${item.quantity} x ${item.title}${item.size ? ` (${item.size})` : ""}`)
      .join(", "),
    quantity: items.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
    subtotal,
    deliveryFee: fee,
    grandTotal: subtotal + fee,
  };
}

/** "ORD-20260926-004217": the date the order was placed and six digits to tell same-day orders apart. */
export function orderNumber(submittedAtIso: string, suffix: number): string {
  return `ORD-${submittedAtIso.slice(0, 10).replace(/-/g, "")}-${String(suffix).padStart(6, "0")}`;
}

/** Payment is settled after an order request is reviewed, so none is awaited up front. */
export function paymentStatusFor(orderType: OrderType): "Not Required" | "Awaiting Payment" {
  return orderType === "Order Request" ? "Not Required" : "Awaiting Payment";
}
