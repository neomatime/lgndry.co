import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CART_KEY, readCart } from "@/features/shop/cart/cart-storage";
import { CheckoutForm, LAST_ORDER_KEY } from "@/features/shop/components/checkout-form";
import { OrderConfirmation } from "@/features/shop/components/order-confirmation";

const push = vi.fn();
let query = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(query),
}));

const placeOrder = vi.fn();
vi.mock("@/features/shop/checkout/actions", () => ({
  placeOrder: (payload: unknown) => placeOrder(payload),
}));

// No Supabase configuration in tests: the form simply isn't pre-filled.
vi.mock("@/lib/db/client", () => ({
  createSupabaseBrowserClient: () => {
    throw new Error("not configured");
  },
}));

const CART = [
  {
    artworkId: "a",
    title: "Alpha",
    size: "50 × 70 cm",
    framing: "Unframed",
    quantity: 2,
    price: 20000,
    maxQuantity: 3,
    image: "x.jpg",
  },
  {
    artworkId: "b",
    title: "Bravo",
    size: "60 × 90 cm",
    framing: "Oak Frame",
    quantity: 1,
    price: 10000,
    maxQuantity: 1,
    image: "y.jpg",
  },
];

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillRequiredFields() {
  type("Full name", "Thandi Mokoena");
  type("Email address", "thandi@example.com");
  type("Phone / WhatsApp", "0761234567");
  type("Delivery address", "1 Main Rd");
  type("City / town", "Polokwane");
  type("Postal code", "0700");
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm that the order details/ }));
}

beforeEach(() => {
  push.mockClear();
  placeOrder.mockReset();
  query = "";
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("CheckoutForm", () => {
  it("sends visitors with an empty cart back to the collection", () => {
    render(<CheckoutForm />);
    expect(screen.getByRole("heading", { name: "Your cart is empty." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to the collection" })).toHaveAttribute(
      "href",
      "/collection",
    );
  });

  describe("with items in the cart", () => {
    beforeEach(() => window.localStorage.setItem(CART_KEY, JSON.stringify(CART)));

    it("summarises the order with delivery", () => {
      render(<CheckoutForm />);
      const summary = document.querySelector<HTMLElement>(".checkout-summary")!;
      expect(within(summary).getByText("Direct Purchase")).toBeInTheDocument();
      expect(within(summary).getByText("R 50 000", { selector: "dd" })).toBeInTheDocument();
      expect(within(summary).getByText("R 250")).toBeInTheDocument();
      expect(within(summary).getByText("R 50 250")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Place Direct Purchase" })).toBeInTheDocument();
    });

    it("becomes an order request when asked to", () => {
      query = "type=request";
      render(<CheckoutForm />);
      expect(screen.getByRole("button", { name: "Place Order Request" })).toBeInTheDocument();
    });

    it("makes delivery details optional and delivery free when collecting", () => {
      const { container } = render(<CheckoutForm />);
      expect(screen.getByLabelText("Delivery address")).toBeRequired();

      const preference = container.querySelector<HTMLElement>(".checkout-field .lgndry-select")!;
      fireEvent.click(within(preference).getByRole("button", { expanded: false }));
      fireEvent.click(within(preference).getByRole("option", { name: "Collect in person" }));

      expect(screen.getByLabelText("Delivery address")).not.toBeRequired();
      expect(screen.getByText("Complimentary")).toBeInTheDocument();
    });

    it("asks for billing details only when they differ", () => {
      const { container } = render(<CheckoutForm />);
      const billing = () => container.querySelector<HTMLElement>(".checkout-grid[hidden]");
      expect(billing()).not.toBeNull();
      expect(screen.getByLabelText("Billing name")).not.toBeRequired();

      fireEvent.click(
        screen.getByRole("checkbox", { name: /Use my delivery details for billing/ }),
      );
      expect(billing()).toBeNull();
      expect(screen.getByLabelText("Billing name")).toBeRequired();
    });

    it("offers card payment only as coming soon", () => {
      render(<CheckoutForm />);
      expect(screen.getByRole("radio", { name: /Debit or credit card/ })).toBeDisabled();
      expect(screen.getByText("Coming soon")).toBeInTheDocument();
    });

    it("places the order without sending any prices, then clears the cart and moves on", async () => {
      const order = { orderNumber: "ORD-20260926-000001", customerName: "Thandi Mokoena" };
      placeOrder.mockResolvedValue({ ok: true, order });
      const { container } = render(<CheckoutForm />);
      fillRequiredFields();
      fireEvent.submit(container.querySelector("form")!);

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith("/order-confirmation?order=ORD-20260926-000001"),
      );
      const sent = placeOrder.mock.calls[0]![0];
      expect(sent).toMatchObject({
        customerName: "Thandi Mokoena",
        customerEmail: "thandi@example.com",
        deliveryMethod: "Deliver to my address",
        paymentMethod: "EFT",
        billingSame: true,
        requestOnly: false,
      });
      expect(sent.lines).toEqual([
        {
          artworkId: "a",
          size: "50 × 70 cm",
          framing: "Unframed",
          quantity: 2,
          requiresConfirmation: false,
        },
        {
          artworkId: "b",
          size: "60 × 90 cm",
          framing: "Oak Frame",
          quantity: 1,
          requiresConfirmation: false,
        },
      ]);
      expect(JSON.stringify(sent)).not.toContain("price");
      expect(readCart()).toEqual([]);
      expect(JSON.parse(window.sessionStorage.getItem(LAST_ORDER_KEY) ?? "null")).toEqual(order);
    });

    it("keeps the cart and explains when the order can't be placed", async () => {
      placeOrder.mockResolvedValue({
        ok: false,
        error: "Only 1 of Bravo remain. Please update your cart.",
      });
      const { container } = render(<CheckoutForm />);
      fillRequiredFields();
      fireEvent.submit(container.querySelector("form")!);

      expect(
        await screen.findByText("Only 1 of Bravo remain. Please update your cart."),
      ).toBeInTheDocument();
      expect(readCart()).toHaveLength(2);
      expect(push).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Place Direct Purchase" })).toBeEnabled();
    });

    it("recovers from a network failure", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      placeOrder.mockRejectedValue(new Error("offline"));
      const { container } = render(<CheckoutForm />);
      fillRequiredFields();
      fireEvent.submit(container.querySelector("form")!);

      expect(
        await screen.findByText(
          "We could not submit your order. Please try again or contact the studio.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Place Direct Purchase" })).toBeEnabled();
    });

    it("does not submit while required details are missing", () => {
      const { container } = render(<CheckoutForm />);
      fireEvent.submit(container.querySelector("form")!);
      expect(placeOrder).not.toHaveBeenCalled();
    });
  });
});

describe("OrderConfirmation", () => {
  const stored = {
    orderNumber: "ORD-20260926-000001",
    orderType: "Direct Purchase",
    customerName: "Thandi Mokoena",
    customerEmail: "thandi@example.com",
    grandTotal: 50250,
    paymentMethod: "EFT",
    paymentStatus: "Awaiting Payment",
    deliveryMethod: "Deliver to my address",
  };

  it("thanks the customer by first name and lists the order", () => {
    window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(stored));
    query = "order=ORD-20260926-000001";
    render(<OrderConfirmation />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Thank you,Thandi."); // the line break has no text of its own;
    expect(screen.getByText("ORD-20260926-000001")).toBeInTheDocument();
    expect(screen.getByText("thandi@example.com")).toBeInTheDocument();
    expect(screen.getByText("R 50 250")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Payment")).toBeInTheDocument();
  });

  it("falls back to the privacy message for another order or none", () => {
    window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(stored));
    query = "order=ORD-SOMEONE-ELSE";
    const { unmount } = render(<OrderConfirmation />);
    expect(screen.getByText(/no longer available in this browser/)).toBeInTheDocument();
    unmount();

    window.sessionStorage.clear();
    query = "";
    render(<OrderConfirmation />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Your order has been received." }),
    ).toBeInTheDocument();
  });

  it("copes with a damaged stored order", () => {
    window.sessionStorage.setItem(LAST_ORDER_KEY, "{not json");
    render(<OrderConfirmation />);
    expect(screen.getByText(/no longer available in this browser/)).toBeInTheDocument();
  });
});
