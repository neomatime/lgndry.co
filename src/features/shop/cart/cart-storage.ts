// The shopping cart lives in the visitor's browser (localStorage), under the
// same key and shape the legacy site used, so a cart started before the
// migration survives it. Ported from the legacy commerce-core.js.

export const CART_KEY = "lgndry_collection_cart_v2";

/** Fired on `window` whenever the cart changes in this tab. */
export const CART_CHANGE_EVENT = "lgndry-cart-change";

export type CartItem = {
  artworkId?: string;
  quantity?: number;
  price?: number;
  [field: string]: unknown;
};

/** Parses the stored cart; anything missing, corrupt or not an array is an empty cart. */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** Total units across all lines. A line with no quantity counts as one. */
export function cartCount(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
}

export function readCartCount(): number {
  try {
    return cartCount(parseCart(window.localStorage.getItem(CART_KEY)));
  } catch {
    return 0; // storage blocked
  }
}
