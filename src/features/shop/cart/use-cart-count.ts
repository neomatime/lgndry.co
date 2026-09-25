"use client";

import { useSyncExternalStore } from "react";
import { CART_CHANGE_EVENT, CART_KEY, readCartCount } from "@/features/shop/cart/cart-storage";

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    // Another tab changed the cart (key is null when storage was cleared).
    if (event.key === null || event.key === CART_KEY) notify();
  };
  window.addEventListener(CART_CHANGE_EVENT, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CART_CHANGE_EVENT, notify);
    window.removeEventListener("storage", onStorage);
  };
}

/** Live number of items in the cart. 0 on the server and during hydration. */
export function useCartCount(): number {
  return useSyncExternalStore(subscribe, readCartCount, () => 0);
}
