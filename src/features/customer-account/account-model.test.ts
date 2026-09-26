import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDING,
  authCallbackUrl,
  safeCustomerNext,
} from "@/features/customer-account/next-path";
import {
  ACCOUNT_ORDER_COLUMNS,
  cancelledAt,
  firstItem,
  historyFor,
  orderTotal,
  stepsFor,
  trackerSteps,
  type AccountOrder,
} from "@/features/customer-account/orders";

describe("safeCustomerNext", () => {
  it("keeps same-site paths, query and fragment", () => {
    expect(safeCustomerNext("/account#settings")).toBe("/account#settings");
    expect(safeCustomerNext("/checkout?type=request")).toBe("/checkout?type=request");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "account",
      "",
    ]) {
      expect(safeCustomerNext(bad)).toBe(DEFAULT_LANDING);
    }
    expect(safeCustomerNext(null)).toBe(DEFAULT_LANDING);
    expect(safeCustomerNext(undefined)).toBe(DEFAULT_LANDING);
  });
});

describe("authCallbackUrl", () => {
  it("uses the .html address the auth allow-list knows", () => {
    expect(authCallbackUrl("https://www.lgndry-co.co.za")).toBe(
      "https://www.lgndry-co.co.za/auth-callback.html",
    );
  });
});

const order = (over: Partial<AccountOrder> = {}): AccountOrder => ({
  id: "o1",
  orderNumber: "ORD-1",
  customerName: "T",
  customerEmail: "t@example.com",
  customerPhone: "1",
  items: [{ title: "Alpha", image: "a.jpg" }],
  itemSummary: "1 x Alpha",
  quantity: 1,
  subtotal: 100,
  grandTotal: 350,
  deliveryMethod: "Deliver to my address",
  deliveryAddress: "x",
  deliveryCity: "y",
  postalCode: "z",
  notes: null,
  submittedAt: "2026-09-01T10:00:00Z",
  status: "Preparing",
  statusHistory: [
    { status: "New", at: "2026-09-01T10:00:00Z" },
    { status: "Confirmed", at: "2026-09-02T10:00:00Z" },
    { status: "Preparing", at: "2026-09-03T10:00:00Z" },
  ],
  ...over,
});

describe("tracker", () => {
  it("has a collection and a delivery timeline", () => {
    expect(stepsFor({ deliveryMethod: "Collect in person" })).toEqual([
      "Confirmed",
      "Preparing",
      "Ready for Collection",
      "Completed",
    ]);
    expect(stepsFor({ deliveryMethod: "Deliver to my address" })[2]).toBe("Out for Delivery");
  });

  it("marks reached stages complete and the rest empty", () => {
    const steps = trackerSteps(order());
    expect(steps.map((s) => s.state)).toEqual(["complete", "complete", "", ""]);
    expect(steps[0]?.at).toBe("2026-09-02T10:00:00Z");
    expect(steps[1]?.at).toBe("2026-09-03T10:00:00Z");
    expect(steps[3]?.at).toBeNull();
  });

  it("marks the current stage when it has no recorded event of its own", () => {
    const steps = trackerSteps(
      order({
        status: "Preparing",
        statusHistory: [{ status: "Confirmed", at: "2026-09-02T10:00:00Z" }],
      }),
    );
    expect(steps.map((s) => s.state)).toEqual(["complete", "current", "", ""]);
  });

  it("counts an order with no history as having reached its current status", () => {
    const steps = trackerSteps(order({ statusHistory: [], status: "Preparing" }));
    expect(steps.map((s) => s.state)).toEqual(["", "complete", "", ""]);
  });

  it("uses the latest event when a stage repeats", () => {
    const steps = trackerSteps(
      order({
        statusHistory: [
          { status: "Confirmed", at: "A" },
          { status: "Confirmed", at: "B" },
        ],
      }),
    );
    expect(steps[0]?.at).toBe("B");
  });
});

describe("historyFor / cancelledAt", () => {
  it("falls back to the current status when nothing is recorded", () => {
    expect(historyFor(order({ statusHistory: null, status: "New Request" }))).toEqual([
      { status: "New Request", at: "2026-09-01T10:00:00Z" },
    ]);
  });

  it("reports when an order was cancelled", () => {
    const cancelled = order({
      status: "Cancelled",
      statusHistory: [{ status: "Cancelled", at: "2026-09-05T00:00:00Z" }],
    });
    expect(cancelledAt(cancelled)).toBe("2026-09-05T00:00:00Z");
    expect(cancelledAt(order())).toBeNull();
  });
});

describe("helpers", () => {
  it("firstItem and orderTotal tolerate old or partial orders", () => {
    expect(firstItem(order())).toEqual({ title: "Alpha", image: "a.jpg" });
    expect(firstItem(order({ items: null }))).toEqual({});
    expect(orderTotal(order())).toBe(350);
    expect(orderTotal(order({ grandTotal: null }))).toBe(100);
  });

  it("never asks for the studio's private notes", () => {
    expect(ACCOUNT_ORDER_COLUMNS).not.toContain("internalNotes");
    expect(ACCOUNT_ORDER_COLUMNS).not.toContain("*");
  });
});
