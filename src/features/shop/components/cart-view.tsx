"use client";

import Link from "next/link";
import { useState } from "react";
import {
  cartSubtotal,
  deliveryFee,
  removeFromCart,
  updateCartQuantity,
  type CartItem,
} from "@/features/shop/cart/cart-storage";
import { useCart } from "@/features/shop/cart/use-cart";
import { imageSrc } from "@/features/shop/catalogue/artwork";
import { formatMoney } from "@/features/shop/money";

function PageHead({ intro }: { intro: string }) {
  return (
    <header className="commerce-page__head">
      <span>Private selection</span>
      <h1>Your cart.</h1>
      <p>{intro}</p>
    </header>
  );
}

/**
 * A quantity box that commits on Enter, on leaving the box, and when the
 * spinner arrows are used — but not on every keystroke, so clearing the box to
 * type a new number doesn't remove the line.
 */
function QuantityInput({
  title,
  quantity,
  max,
  onCommit,
}: {
  title: string;
  quantity: number;
  max: number;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (text: string) => {
    setDraft(null);
    onCommit(Number(text));
  };
  return (
    <input
      type="number"
      min="1"
      max={max}
      value={draft ?? String(quantity)}
      aria-label={`Quantity for ${title}`}
      onChange={(event) => {
        const typed = "inputType" in event.nativeEvent && Boolean(event.nativeEvent.inputType);
        if (typed) setDraft(event.target.value);
        else commit(event.target.value); // spinner arrows
      }}
      onBlur={(event) => {
        if (draft !== null) commit(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit(event.currentTarget.value);
      }}
    />
  );
}

function CartLine({ item, index }: { item: CartItem; index: number }) {
  const title = item.title ?? "";
  const quantity = Number(item.quantity || 1);
  const href = `/showroom/${encodeURIComponent(item.artworkId ?? "")}`;
  return (
    <article className="cart-line">
      <Link href={href}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc(item.image ?? "")} alt={title} loading="lazy" decoding="async" />
      </Link>
      <div className="cart-line__details">
        <span>{item.artist || "Dan Mokgwadi"}</span>
        <h2>{title}</h2>
        <p>
          {item.size} · {item.framing || "Unframed"}
        </p>
        <div className="cart-line__controls">
          <label>
            Quantity{" "}
            <QuantityInput
              key={quantity}
              title={title}
              quantity={quantity}
              max={Number(item.maxQuantity || 1)}
              onCommit={(next) => updateCartQuantity(index, next)}
            />
          </label>
          <button
            type="button"
            aria-label={`Remove ${title} from cart`}
            onClick={() => removeFromCart(index)}
          >
            Remove
          </button>
        </div>
      </div>
      <strong>{formatMoney(Number(item.price) * quantity)}</strong>
    </article>
  );
}

/** The visitor's cart, read from their browser (so it renders once the page is live). */
export function CartView() {
  const { items, hydrated } = useCart();
  // The cart only exists in the browser; until then there is nothing to show.
  if (!hydrated) return null;

  if (!items.length) {
    return (
      <>
        <PageHead intro="Works you select will remain here while you continue exploring." />
        <section className="commerce-empty">
          <h2>Your cart is empty.</h2>
          <p>Your selected editions and presentation choices will appear here.</p>
          <Link className="commerce-empty__action" href="/collection">
            Explore the collection
          </Link>
        </section>
      </>
    );
  }

  const subtotal = cartSubtotal(items);
  const delivery = deliveryFee("delivery", items);

  return (
    <>
      <PageHead intro="Review editions and presentation options before continuing to checkout." />
      <div className="cart-layout">
        <section className="cart-list" aria-label="Selected artworks">
          {items.map((item, index) => (
            <CartLine
              key={`${item.artworkId}-${item.size}-${item.framing}`}
              item={item}
              index={index}
            />
          ))}
        </section>
        <aside className="cart-summary">
          <span>Order summary</span>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(subtotal)}</dd>
            </div>
            <div>
              <dt>Estimated delivery</dt>
              <dd>{formatMoney(delivery)}</dd>
            </div>
            <div className="cart-summary__total">
              <dt>Estimated total</dt>
              <dd>{formatMoney(subtotal + delivery)}</dd>
            </div>
          </dl>
          <p>
            Collection is free. Final delivery and EFT instructions are confirmed before fulfilment.
          </p>
          <Link className="commerce-primary" href="/checkout">
            Proceed to Checkout
          </Link>
          <Link className="commerce-text-link" href="/collection">
            Continue shopping
          </Link>
        </aside>
      </div>
    </>
  );
}
