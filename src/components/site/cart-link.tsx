"use client";

import Link from "next/link";
import { useCartCount } from "@/features/shop/cart/use-cart-count";

/** The cart icon with a live count, used in both site headers. */
export function CartLink() {
  const cartCount = useCartCount();
  return (
    <Link
      href="/cart"
      className="commerce-cart-link commerce-cart-link--header"
      data-commerce-cart-link=""
      aria-label={
        cartCount
          ? `View shopping cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
          : "View shopping cart, empty"
      }
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 8H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
      </svg>
      <span data-commerce-cart-count="" hidden={cartCount === 0}>
        {cartCount}
      </span>
    </Link>
  );
}
