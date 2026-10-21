import { describe, expect, it } from "vitest";
import { calculateTotals, invoiceDisplayStatus, reference } from "@/features/invoices/view-model";

describe("commercial view model", () => {
  it("calculates ZAR totals with an explicit discount", () => {
    expect(calculateTotals([{ quantity: 2, unitAmount: 1250 }], 300)).toEqual({
      subtotal: 2500,
      discountAmount: 300,
      total: 2200,
    });
  });

  it("derives overdue and partial states without rewriting stored status", () => {
    expect(invoiceDisplayStatus("Sent", 0, 100, "2026-10-19", "2026-10-20")).toBe("Overdue");
    expect(invoiceDisplayStatus("Sent", 50, 100, "2026-10-30", "2026-10-20")).toBe(
      "Partially Paid",
    );
  });

  it("builds stable human references", () => {
    expect(reference("INV", 42, "2026-10-20T10:00:00Z")).toBe("INV-2026-0042");
  });
});
