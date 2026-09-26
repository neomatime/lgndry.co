"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LAST_ORDER_KEY } from "@/features/shop/components/checkout-form";
import { formatMoney } from "@/features/shop/money";
import { useHydrated } from "@/hooks/use-hydrated";

type StoredOrder = {
  orderNumber: string;
  orderType: string;
  customerName: string;
  customerEmail: string;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryMethod: string;
};

/** The order kept by checkout for this tab, or null if there isn't a usable one. */
function readOrder(): StoredOrder | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(LAST_ORDER_KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    const order = value as Record<string, unknown>;
    const text = (key: string) => (order[key] == null ? "" : String(order[key]));
    const total =
      order.grandTotal != null
        ? Number(order.grandTotal)
        : Number(order.subtotal || 0) + Number(order.deliveryFee || 0);
    return {
      orderNumber: text("orderNumber"),
      orderType: text("orderType"),
      customerName: text("customerName"),
      customerEmail: text("customerEmail"),
      grandTotal: total,
      paymentMethod: text("paymentMethod"),
      paymentStatus: text("paymentStatus"),
      deliveryMethod: text("deliveryMethod"),
    };
  } catch {
    return null;
  }
}

export function OrderConfirmation() {
  const hydrated = useHydrated();
  const expected = useSearchParams().get("order");
  // The order lives only in this browser tab, so there is nothing to show until it is running.
  if (!hydrated) return null;

  const order = readOrder();
  if (!order || (expected && order.orderNumber !== expected)) {
    return (
      <section className="confirmation-card">
        <span>Order confirmation</span>
        <h1>Your order has been received.</h1>
        <p>
          For privacy, this summary is no longer available in this browser. Signed-in customers can
          review their orders in My Account.
        </p>
        <div>
          <Link className="commerce-primary" href="/account#orders">
            My Account
          </Link>
          <Link className="commerce-text-link" href="/collection">
            Return to collection
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="confirmation-card">
      <span>{order.orderType || "Order"} received</span>
      <h1>
        Thank you,
        <br />
        {order.customerName.split(" ")[0]}.
      </h1>
      <p>
        Your order <strong>{order.orderNumber}</strong> has been sent to the LGNDRY.Co studio. A
        confirmation will be sent to <strong>{order.customerEmail}</strong>.
      </p>
      <dl>
        <div>
          <dt>Order total</dt>
          <dd>{formatMoney(order.grandTotal)}</dd>
        </div>
        <div>
          <dt>Payment method</dt>
          <dd>{order.paymentMethod}</dd>
        </div>
        <div>
          <dt>Payment status</dt>
          <dd>{order.paymentStatus}</dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd>{order.deliveryMethod}</dd>
        </div>
      </dl>
      <p className="confirmation-note">
        The studio will confirm availability, delivery, and EFT instructions before fulfilment. No
        card details have been collected.
      </p>
      <div>
        <Link className="commerce-primary" href="/account#orders">
          View My Orders
        </Link>
        <Link className="commerce-text-link" href="/collection">
          Continue exploring
        </Link>
      </div>
    </section>
  );
}
