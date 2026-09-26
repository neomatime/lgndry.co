"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Select } from "@/components/site/forms/select";
import { CARD_PAYMENT_ENABLED } from "@/content/payment";
import {
  cartSubtotal,
  clearCart,
  deliveryFee,
  type CartItem,
} from "@/features/shop/cart/cart-storage";
import { useCart } from "@/features/shop/cart/use-cart";
import { imageSrc } from "@/features/shop/catalogue/artwork";
import { placeOrder } from "@/features/shop/checkout/actions";
import { COLLECT, DELIVER } from "@/features/shop/checkout/schema";
import { formatMoney } from "@/features/shop/money";
import { createSupabaseBrowserClient } from "@/lib/db/client";
import { cn } from "@/lib/utils/cn";

/** Where the placed order is kept for the confirmation page, for this tab only. */
export const LAST_ORDER_KEY = "lgndry_last_order";

const FAILED = "We could not submit your order. Please try again or contact the studio.";

type FieldName =
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "delivery_address"
  | "delivery_city"
  | "postal_code"
  | "billing_name"
  | "billing_address"
  | "billing_city"
  | "billing_postal_code";

const AUTOCOMPLETE: Record<FieldName, string> = {
  customer_name: "name",
  customer_email: "email",
  customer_phone: "tel",
  delivery_address: "street-address",
  delivery_city: "address-level2",
  postal_code: "postal-code",
  billing_name: "name",
  billing_address: "street-address",
  billing_city: "address-level2",
  billing_postal_code: "postal-code",
};

const EMPTY: Record<FieldName, string> = {
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  delivery_address: "",
  delivery_city: "",
  postal_code: "",
  billing_name: "",
  billing_address: "",
  billing_city: "",
  billing_postal_code: "",
};

export function CheckoutForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { items, hydrated } = useCart();
  const [values, setValues] = useState(EMPTY);
  const [deliveryMethod, setDeliveryMethod] = useState(DELIVER);
  const [billingSame, setBillingSame] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("EFT");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  // Once the order is placed the cart is emptied; keep showing what was ordered until we leave.
  const [placed, setPlaced] = useState<CartItem[] | null>(null);

  // A signed-in customer's details are filled in, without overwriting anything already typed.
  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      return; // not configured: the customer just types their details
    }
    const fill = (patch: Partial<Record<FieldName, string>>) => {
      if (!active) return;
      setValues((current) => {
        const next = { ...current };
        for (const [name, value] of Object.entries(patch)) {
          if (value && !current[name as FieldName]) next[name as FieldName] = value;
        }
        return next;
      });
    };
    void (async () => {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      fill({
        customer_email: user.email ?? "",
        customer_name: (user.user_metadata as { full_name?: string } | null)?.full_name ?? "",
      });
      const { data: profile } = await client
        .from("customer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) return;
      fill({
        customer_name: profile.full_name,
        customer_phone: profile.phone,
        delivery_address: profile.address,
        delivery_city: profile.city,
        postal_code: profile.postal_code,
      });
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!hydrated) return null;

  const cart = placed ?? items;
  if (!cart.length) {
    return (
      <section className="commerce-empty">
        <h2>Your cart is empty.</h2>
        <p>Select a work before continuing to checkout.</p>
        <Link className="commerce-empty__action" href="/collection">
          Return to the collection
        </Link>
      </section>
    );
  }

  const requestOnly = search.get("type") === "request";
  const orderType =
    requestOnly || cart.some((item) => item.requiresConfirmation)
      ? "Order Request"
      : "Direct Purchase";
  const collecting = deliveryMethod === COLLECT;
  const subtotal = cartSubtotal(cart);
  const fee = deliveryFee(deliveryMethod, cart);

  const set = (name: FieldName) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [name]: event.target.value }));

  const field = (
    name: FieldName,
    label: string,
    options: { type?: string; required?: boolean; wide?: boolean; optional?: boolean } = {},
  ) => (
    <label
      className={cn(
        "checkout-field",
        options.wide && "checkout-field--wide",
        options.optional && "is-optional",
      )}
    >
      <span>{label}</span>
      <input
        type={options.type ?? "text"}
        name={name}
        autoComplete={AUTOCOMPLETE[name]}
        required={options.required}
        value={values[name]}
        onChange={set(name)}
      />
    </label>
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setSubmitting(true);
    setFeedback("");
    try {
      const result = await placeOrder({
        customerName: values.customer_name,
        customerEmail: values.customer_email,
        customerPhone: values.customer_phone,
        deliveryMethod,
        deliveryAddress: values.delivery_address,
        deliveryCity: values.delivery_city,
        postalCode: values.postal_code,
        billingSame,
        billingName: values.billing_name,
        billingAddress: values.billing_address,
        billingCity: values.billing_city,
        billingPostalCode: values.billing_postal_code,
        notes,
        paymentMethod,
        requestOnly,
        lines: cart.map((item) => ({
          artworkId: item.artworkId ?? "",
          size: item.size ?? "",
          framing: item.framing ?? "",
          quantity: Number(item.quantity || 1),
          requiresConfirmation: Boolean(item.requiresConfirmation),
        })),
        hp_website: (form.elements.namedItem("hp_website") as HTMLInputElement | null)?.value,
      });
      if (!result.ok) {
        setFeedback(result.error);
        setSubmitting(false);
        return;
      }
      try {
        window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(result.order));
      } catch {
        // Storage blocked: the confirmation page falls back to its generic message.
      }
      setPlaced(cart);
      clearCart();
      router.push(`/order-confirmation?order=${encodeURIComponent(result.order.orderNumber)}`);
    } catch (error) {
      console.error(error);
      setFeedback(FAILED);
      setSubmitting(false);
    }
  };

  return (
    <form className="checkout-layout" autoComplete="on" onSubmit={submit}>
      {/* Spam trap: invisible to people, tempting to bots. */}
      <input
        type="text"
        name="hp_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <div className="checkout-sections">
        <section className="checkout-section">
          <span>01 · Customer</span>
          <h2>Your details</h2>
          <div className="checkout-grid">
            {field("customer_name", "Full name", { required: true })}
            {field("customer_email", "Email address", { type: "email", required: true })}
            {field("customer_phone", "Phone / WhatsApp", { type: "tel", required: true })}
          </div>
        </section>

        <section className="checkout-section">
          <span>02 · Delivery</span>
          <h2>Delivery or collection</h2>
          <div className="checkout-grid">
            <label className="checkout-field">
              <span>Preference</span>
              <Select
                name="delivery_method"
                required
                options={[DELIVER, COLLECT]}
                value={deliveryMethod}
                label="Preference"
                onChange={setDeliveryMethod}
              />
            </label>
            {field("delivery_address", "Delivery address", {
              required: !collecting,
              optional: collecting,
              wide: true,
            })}
            {field("delivery_city", "City / town", { required: !collecting, optional: collecting })}
            {field("postal_code", "Postal code", { required: !collecting, optional: collecting })}
          </div>
        </section>

        <section className="checkout-section">
          <span>03 · Billing</span>
          <h2>Billing details</h2>
          <label className="checkout-check">
            <input
              type="checkbox"
              name="billing_same"
              checked={billingSame}
              onChange={(event) => setBillingSame(event.target.checked)}
            />{" "}
            Use my delivery details for billing
          </label>
          <div className="checkout-grid" hidden={billingSame}>
            {field("billing_name", "Billing name", { required: !billingSame })}
            {field("billing_address", "Billing address", { required: !billingSame, wide: true })}
            {field("billing_city", "Billing city", { required: !billingSame })}
            {field("billing_postal_code", "Billing postal code", { required: !billingSame })}
          </div>
        </section>

        <section className="checkout-section">
          <span>04 · Payment</span>
          <h2>Payment method</h2>
          <div className="checkout-payment-options">
            <label>
              <input
                type="radio"
                name="payment_method"
                value="EFT"
                checked={paymentMethod === "EFT"}
                onChange={() => setPaymentMethod("EFT")}
              />
              <strong>Electronic funds transfer</strong>
              <span>Banking instructions will be included after availability is reviewed.</span>
            </label>
            <label>
              <input
                type="radio"
                name="payment_method"
                value="Payment in person"
                checked={paymentMethod === "Payment in person"}
                onChange={() => setPaymentMethod("Payment in person")}
              />
              <strong>Payment in person</strong>
              <span>Arrange payment with the studio when collection or delivery is confirmed.</span>
            </label>
            <label className={cn("checkout-payment-card", !CARD_PAYMENT_ENABLED && "is-disabled")}>
              <input
                type="radio"
                name="payment_method"
                value="Debit / Credit Card"
                disabled={!CARD_PAYMENT_ENABLED}
              />
              <strong>Debit or credit card</strong>
              <span>
                {CARD_PAYMENT_ENABLED
                  ? "Pay securely without leaving the LGNDRY.Co checkout."
                  : "Secure card checkout is being prepared."}
              </span>
              {CARD_PAYMENT_ENABLED ? null : <em>Coming soon</em>}
            </label>
          </div>
          <label className="checkout-field" style={{ marginTop: 24 }}>
            <span>Order notes</span>
            <textarea
              name="order_notes"
              placeholder="Framing requests, access details, gifting notes, or anything the studio should know."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <label className="checkout-check">
            <input type="checkbox" required /> I confirm that the order details are correct and
            understand fulfilment begins after availability and payment are confirmed.
          </label>
        </section>
      </div>

      <aside className="checkout-summary">
        <span>{orderType}</span>
        <h2>Order summary</h2>
        <div className="checkout-summary__items">
          {cart.map((item) => (
            <div key={`${item.artworkId}-${item.size}-${item.framing}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc(item.image ?? "")}
                alt={item.title ?? ""}
                loading="lazy"
                decoding="async"
              />
              <p>
                <strong>{item.title}</strong>
                <small>
                  {item.size} · {item.framing}
                  <br />
                  Qty {item.quantity}
                </small>
              </p>
              <b>{formatMoney(Number(item.price) * Number(item.quantity))}</b>
            </div>
          ))}
        </div>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(subtotal)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>{fee ? formatMoney(fee) : "Complimentary"}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatMoney(subtotal + fee)}</dd>
          </div>
        </dl>
        <p className="checkout-security">No card information is requested or stored.</p>
        <p className="checkout-feedback" role="status" aria-live="polite">
          {feedback}
        </p>
        <button className="commerce-primary" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : `Place ${orderType}`}
        </button>
      </aside>
    </form>
  );
}
