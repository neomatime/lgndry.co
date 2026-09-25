import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavPanel } from "@/components/site/nav-panel";
import { NavProvider } from "@/components/site/nav-context";
import { SiteHeader } from "@/components/site/site-header";
import { CART_CHANGE_EVENT, CART_KEY } from "@/features/shop/cart/cart-storage";
import type { CustomerSession } from "@/features/customer-account/use-customer-session";

let customerSession: CustomerSession = "signed-out";
vi.mock("@/features/customer-account/use-customer-session", () => ({
  useCustomerSession: () => customerSession,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

function renderChrome() {
  return render(
    <NavProvider>
      <SiteHeader />
      <NavPanel />
    </NavProvider>,
  );
}

const panel = () => document.getElementById("navPanel") as HTMLElement;

beforeEach(() => {
  customerSession = "signed-out";
  // jsdom has no matchMedia; report "no reduced motion, not mobile".
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => window.localStorage.clear());

describe("navigation panel", () => {
  it("starts closed and unreachable", () => {
    renderChrome();
    expect(panel()).toHaveAttribute("aria-hidden", "true");
    expect(panel()).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens from the Menu button and moves focus to Close", async () => {
    renderChrome();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    await waitFor(() => expect(panel()).toHaveAttribute("aria-hidden", "false"));
    expect(panel()).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(document.body).toHaveClass("nav-is-open");
  });

  it("closes on Escape and returns focus to the Menu button", async () => {
    renderChrome();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() => expect(panel()).toHaveAttribute("aria-hidden", "false"));

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(panel()).toHaveAttribute("aria-hidden", "true"));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
    expect(document.body).not.toHaveClass("nav-is-open");
  });

  it("closes when clicking outside the panel", async () => {
    renderChrome();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() => expect(panel()).toHaveAttribute("aria-hidden", "false"));

    fireEvent.click(document.body);

    await waitFor(() => expect(panel()).toHaveAttribute("aria-hidden", "true"));
  });

  it("keeps Tab inside the open panel", async () => {
    renderChrome();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() => expect(panel()).toHaveAttribute("aria-hidden", "false"));

    const focusable = panel().querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    focusable[focusable.length - 1]?.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(focusable[0]).toHaveFocus();
  });

  it("marks the current page and lists every section", () => {
    renderChrome();
    const links = panel().querySelectorAll("a.nav-panel__item");
    expect(Array.from(links).map((link) => link.textContent)).toEqual([
      "Home",
      "Practice",
      "Collections",
      "About",
      "Contact",
    ]);
    expect(screen.getByRole("link", { name: "Home", hidden: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("offers Log In / Create Account to visitors who are signed out", () => {
    customerSession = "signed-out";
    renderChrome();
    expect(screen.getByRole("link", { name: "Log In", hidden: true })).toHaveAttribute(
      "href",
      "/auth?mode=login",
    );
    expect(screen.getByRole("link", { name: "Create Account", hidden: true })).toHaveAttribute(
      "href",
      "/auth?mode=signup",
    );
  });

  it("offers My Account to signed-in customers", () => {
    customerSession = "signed-in";
    renderChrome();
    expect(screen.getByRole("link", { name: "My Account", hidden: true })).toHaveAttribute(
      "href",
      "/account#orders",
    );
    expect(screen.queryByRole("link", { name: "Log In", hidden: true })).toBeNull();
  });

  it("shows no account links until it knows who the visitor is", () => {
    customerSession = "loading";
    renderChrome();
    expect(screen.queryByRole("link", { name: "Log In", hidden: true })).toBeNull();
    expect(screen.queryByRole("link", { name: "My Account", hidden: true })).toBeNull();
  });
});

describe("header cart link", () => {
  it("shows an empty cart with no count badge", () => {
    renderChrome();
    const link = screen.getByRole("link", { name: "View shopping cart, empty" });
    expect(link).toHaveAttribute("href", "/cart");
    expect(link.querySelector("[data-commerce-cart-count]")).toHaveAttribute("hidden");
  });

  it("shows the number of items and updates as the cart changes", () => {
    renderChrome();
    act(() => {
      window.localStorage.setItem(CART_KEY, JSON.stringify([{ quantity: 2 }, { quantity: 1 }]));
      window.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT));
    });
    const link = screen.getByRole("link", { name: "View shopping cart, 3 items" });
    expect(link.querySelector("[data-commerce-cart-count]")).toHaveTextContent("3");
    expect(link.querySelector("[data-commerce-cart-count]")).not.toHaveAttribute("hidden");
  });

  it("uses the singular for one item", () => {
    window.localStorage.setItem(CART_KEY, JSON.stringify([{ quantity: 1 }]));
    renderChrome();
    expect(screen.getByRole("link", { name: "View shopping cart, 1 item" })).toBeInTheDocument();
  });
});
