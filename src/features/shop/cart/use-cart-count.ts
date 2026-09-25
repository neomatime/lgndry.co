"use client";

import { useSyncExternalStore } from "react";
import { readCartCount } from "@/features/shop/cart/cart-storage";
import { subscribeToCart } from "@/features/shop/cart/use-cart";

/** Live number of items in the cart. 0 on the server and during hydration. */
export function useCartCount(): number {
  return useSyncExternalStore(subscribeToCart, readCartCount, () => 0);
}
