// The shopping cart lives in the visitor's browser (localStorage), under the
// same key and shape the legacy site used, so a cart started before the
// migration survives it. Ported from the legacy commerce-core.js.

import { lines, type Artwork } from "@/features/shop/catalogue/artwork";

export const CART_KEY = "lgndry_collection_cart_v2";

/** Fired on `window` whenever the cart changes in this tab. */
export const CART_CHANGE_EVENT = "lgndry-cart-change";

/** Flat delivery charge, waived for collection. */
export const DELIVERY_FEE = 250;

/**
 * One line of the cart. Every field is optional because carts written by the
 * legacy site (or an older build) may lack some; readers fall back sensibly.
 */
export type CartItem = {
  artworkId?: string;
  title?: string;
  artist?: string;
  year?: number | null;
  category?: string;
  collectionName?: string;
  size?: string;
  framing?: string;
  quantity?: number;
  price?: number;
  /** As stored on the artwork: a site path or a full URL. */
  image?: string;
  details?: string;
  maxQuantity?: number;
  remaining?: number;
  requiresConfirmation?: boolean;
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

/** Sum of price × quantity across all lines. */
export function cartSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
}

/** Delivery is free when the visitor collects, and there's nothing to deliver for an empty cart. */
export function deliveryFee(method: string, cart: CartItem[]): number {
  if (/collect/i.test(method)) return 0;
  return cart.length ? DELIVERY_FEE : 0;
}

/** The most of a work that can be bought: what's left in the edition, at least one. */
function maxQuantity(item: CartItem): number {
  return Math.max(1, Number(item.maxQuantity || item.remaining || 1));
}

/** Two lines are the same purchase when work, size and framing all match. */
function lineKey(item: CartItem): string {
  return [item.artworkId, item.size || "", item.framing || ""].join("::");
}

/** Adds a line, merging into an existing identical one; quantities never pass the edition limit. */
export function addLine(cart: CartItem[], item: CartItem): CartItem[] {
  const key = lineKey(item);
  const max = maxQuantity(item);
  const found = cart.some((entry) => lineKey(entry) === key);
  if (found) {
    return cart.map((entry) =>
      lineKey(entry) === key
        ? {
            ...entry,
            quantity: Math.min(max, Number(entry.quantity || 1) + Number(item.quantity || 1)),
          }
        : entry,
    );
  }
  return [...cart, { ...item, quantity: Math.min(max, Math.max(1, Number(item.quantity || 1))) }];
}

/** Sets a line's quantity (capped at the edition limit); zero or less removes it. */
export function setLineQuantity(cart: CartItem[], index: number, quantity: number): CartItem[] {
  const item = cart[index];
  if (!item || Number.isNaN(quantity)) return cart;
  if (quantity <= 0) return removeLine(cart, index);
  return cart.map((entry, i) =>
    i === index ? { ...entry, quantity: Math.min(maxQuantity(entry), quantity) } : entry,
  );
}

export function removeLine(cart: CartItem[], index: number): CartItem[] {
  return cart.filter((_, i) => i !== index);
}

/** What to store when a visitor adds `product` with these choices. */
export function itemFromProduct(
  product: Artwork,
  options: { size?: string; framing?: string; quantity?: number } = {},
): CartItem {
  return {
    artworkId: product.id,
    title: product.title,
    artist: product.artist,
    year: product.year,
    category: product.category,
    collectionName: product.collectionName,
    size: options.size || lines(product.sizes)[0] || "",
    framing: options.framing || "Unframed",
    quantity: Number(options.quantity || 1),
    price: product.price,
    image: product.image,
    details: product.seriesLabel || product.medium || "Archival Pigment Print",
    maxQuantity: Math.max(1, product.remaining),
    requiresConfirmation: product.requiresConfirmation,
  };
}

/** The stored cart text, or null when there is none or storage is blocked. */
export function readRawCart(): string | null {
  try {
    return window.localStorage.getItem(CART_KEY);
  } catch {
    return null; // storage blocked
  }
}

export function readCart(): CartItem[] {
  return parseCart(readRawCart());
}

export function readCartCount(): number {
  return cartCount(readCart());
}

/** Stores the cart and tells every listener in this tab. */
export function writeCart(cart: CartItem[]): CartItem[] {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // Storage blocked or full: nothing more can be done here.
  }
  window.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT, { detail: cart }));
  return cart;
}

export const addToCart = (item: CartItem) => writeCart(addLine(readCart(), item));
export const updateCartQuantity = (index: number, quantity: number) =>
  writeCart(setLineQuantity(readCart(), index, quantity));
export const removeFromCart = (index: number) => writeCart(removeLine(readCart(), index));
export const clearCart = () => writeCart([]);
