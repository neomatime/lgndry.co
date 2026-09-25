"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  CART_CHANGE_EVENT,
  CART_KEY,
  parseCart,
  readRawCart,
  type CartItem,
} from "@/features/shop/cart/cart-storage";

/** Calls `notify` whenever the cart changes, in this tab or another. */
export function subscribeToCart(notify: () => void) {
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

/**
 * The live cart. `hydrated` is false on the server and during hydration, when
 * the (browser-only) cart can't be known yet; `items` is empty until then.
 */
export function useCart(): { items: CartItem[]; hydrated: boolean } {
  // The raw text is the snapshot: it's a stable string, so React can tell
  // when it really changed. The server has no cart, hence `undefined`.
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribeToCart,
    readRawCart,
    () => undefined,
  );
  const items = useMemo(() => parseCart(raw ?? null), [raw]);
  return { items, hydrated: raw !== undefined };
}
