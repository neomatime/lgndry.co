import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  CART_CHANGE_EVENT,
  CART_KEY,
  cartCount,
  parseCart,
  readCartCount,
} from "@/features/shop/cart/cart-storage";
import { useCartCount } from "@/features/shop/cart/use-cart-count";

afterEach(() => window.localStorage.clear());

describe("parseCart", () => {
  it("treats missing, corrupt and non-array data as an empty cart", () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart("")).toEqual([]);
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart('{"quantity":2}')).toEqual([]);
  });

  it("returns the stored lines", () => {
    expect(parseCart('[{"artworkId":"a","quantity":2}]')).toEqual([
      { artworkId: "a", quantity: 2 },
    ]);
  });
});

describe("cartCount", () => {
  it("sums units across lines", () => {
    expect(cartCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
  });

  it("counts a line with no quantity as one, exactly as the legacy cart did", () => {
    expect(cartCount([{}, { quantity: 2 }])).toBe(3);
    expect(cartCount([{ quantity: 0 }])).toBe(1);
  });

  it("is zero for an empty cart", () => {
    expect(cartCount([])).toBe(0);
  });
});

describe("readCartCount / useCartCount", () => {
  it("reads the legacy storage key", () => {
    window.localStorage.setItem(CART_KEY, JSON.stringify([{ quantity: 2 }, { quantity: 1 }]));
    expect(readCartCount()).toBe(3);
  });

  it("follows cart changes made in this tab", () => {
    const { result } = renderHook(() => useCartCount());
    expect(result.current).toBe(0);

    act(() => {
      window.localStorage.setItem(CART_KEY, JSON.stringify([{ quantity: 4 }]));
      window.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT));
    });
    expect(result.current).toBe(4);
  });

  it("follows cart changes made in another tab", () => {
    const { result } = renderHook(() => useCartCount());
    act(() => {
      window.localStorage.setItem(CART_KEY, JSON.stringify([{ quantity: 2 }]));
      window.dispatchEvent(new StorageEvent("storage", { key: CART_KEY }));
    });
    expect(result.current).toBe(2);
  });
});
