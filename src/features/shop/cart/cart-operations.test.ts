import { afterEach, describe, expect, it, vi } from "vitest";
import { artworkFromRow } from "@/features/shop/catalogue/artwork";
import {
  CART_CHANGE_EVENT,
  CART_KEY,
  addLine,
  addToCart,
  cartSubtotal,
  clearCart,
  deliveryFee,
  itemFromProduct,
  readCart,
  removeFromCart,
  removeLine,
  setLineQuantity,
  updateCartQuantity,
  type CartItem,
} from "@/features/shop/cart/cart-storage";

const gae = artworkFromRow({
  id: "g",
  title: "Gae",
  price: 35000,
  remaining: 3,
  image: "assests/images/collection/thumbs/gae.jpg",
  sizes: "50 × 70 cm\n60 × 90 cm",
  seriesLabel: "",
});

const line = (over: CartItem = {}): CartItem => ({
  artworkId: "g",
  size: "50 × 70 cm",
  framing: "Unframed",
  quantity: 1,
  price: 100,
  maxQuantity: 3,
  ...over,
});

afterEach(() => window.localStorage.clear());

describe("itemFromProduct", () => {
  it("captures what checkout and the cart need", () => {
    expect(itemFromProduct(gae)).toMatchObject({
      artworkId: "g",
      title: "Gae",
      artist: "Dan Mokgwadi",
      size: "50 × 70 cm",
      framing: "Unframed",
      quantity: 1,
      price: 35000,
      image: "assests/images/collection/thumbs/gae.jpg",
      details: "Archival Pigment Print",
      maxQuantity: 3,
      requiresConfirmation: false,
    });
  });

  it("honours the chosen size, framing and quantity", () => {
    expect(
      itemFromProduct(gae, { size: "60 × 90 cm", framing: "Oak Frame / Unframed", quantity: 2 }),
    ).toMatchObject({
      size: "60 × 90 cm",
      framing: "Oak Frame / Unframed",
      quantity: 2,
    });
  });

  it("never allows a maximum below one, even for a sold-out work", () => {
    expect(itemFromProduct({ ...gae, remaining: 0 }).maxQuantity).toBe(1);
  });
});

describe("addLine", () => {
  it("adds a new line", () => {
    expect(addLine([], line())).toEqual([line()]);
  });

  it("merges the same work, size and framing, up to the edition limit", () => {
    let cart = addLine([], line({ quantity: 2 }));
    cart = addLine(cart, line({ quantity: 2 }));
    expect(cart).toHaveLength(1);
    expect(cart[0]?.quantity).toBe(3);
  });

  it("keeps different sizes or framings as separate lines", () => {
    const cart = addLine(addLine([], line()), line({ size: "60 × 90 cm" }));
    expect(cart).toHaveLength(2);
  });

  it("clamps a new line's quantity to between one and the limit", () => {
    expect(addLine([], line({ quantity: 99 }))[0]?.quantity).toBe(3);
    expect(addLine([], line({ quantity: 0 }))[0]?.quantity).toBe(1);
  });

  it("does not change the cart it was given", () => {
    const cart = [line()];
    addLine(cart, line());
    expect(cart[0]?.quantity).toBe(1);
  });
});

describe("setLineQuantity / removeLine", () => {
  it("sets a quantity, capped at the limit", () => {
    expect(setLineQuantity([line()], 0, 2)[0]?.quantity).toBe(2);
    expect(setLineQuantity([line()], 0, 50)[0]?.quantity).toBe(3);
  });

  it("removes the line at zero or below", () => {
    expect(setLineQuantity([line()], 0, 0)).toEqual([]);
    expect(setLineQuantity([line()], 0, -1)).toEqual([]);
  });

  it("ignores a missing line or a non-number", () => {
    const cart = [line()];
    expect(setLineQuantity(cart, 4, 2)).toBe(cart);
    expect(setLineQuantity(cart, 0, Number.NaN)).toBe(cart);
  });

  it("removes by index", () => {
    expect(removeLine([line(), line({ size: "x" })], 0)).toEqual([line({ size: "x" })]);
  });
});

describe("totals", () => {
  it("sums price × quantity", () => {
    expect(cartSubtotal([line({ price: 100, quantity: 2 }), line({ price: 50 })])).toBe(250);
    expect(cartSubtotal([])).toBe(0);
  });

  it("charges delivery only for a non-empty cart that isn't collected", () => {
    expect(deliveryFee("delivery", [line()])).toBe(250);
    expect(deliveryFee("Collect in person", [line()])).toBe(0);
    expect(deliveryFee("delivery", [])).toBe(0);
  });
});

describe("stored cart", () => {
  it("writes to the legacy key and announces the change", () => {
    const heard = vi.fn();
    window.addEventListener(CART_CHANGE_EVENT, heard);
    addToCart(line());
    window.removeEventListener(CART_CHANGE_EVENT, heard);

    expect(heard).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]")).toEqual([line()]);
    expect(readCart()).toEqual([line()]);
  });

  it("updates, removes and clears through storage", () => {
    addToCart(line());
    updateCartQuantity(0, 2);
    expect(readCart()[0]?.quantity).toBe(2);
    removeFromCart(0);
    expect(readCart()).toEqual([]);
    addToCart(line());
    clearCart();
    expect(readCart()).toEqual([]);
  });
});
