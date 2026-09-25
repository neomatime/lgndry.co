import { describe, expect, it } from "vitest";
import { formatMoney } from "@/features/shop/money";

describe("formatMoney", () => {
  it("groups thousands with a non-breaking space, like the legacy en-ZA output", () => {
    expect(formatMoney(75000)).toBe("R 75 000");
    expect(formatMoney(1234567)).toBe("R 1 234 567");
    expect(formatMoney(950)).toBe("R 950");
  });

  it("accepts numeric strings, as the database returns them", () => {
    expect(formatMoney("35000.00")).toBe("R 35 000");
  });

  it("uses a decimal comma and at most three decimals", () => {
    expect(formatMoney(1250.5)).toBe("R 1 250,5");
    expect(formatMoney(0.12345)).toBe("R 0,123");
  });

  it("treats empty and invalid amounts as zero", () => {
    expect(formatMoney(undefined)).toBe("R 0");
    expect(formatMoney(null)).toBe("R 0");
    expect(formatMoney("")).toBe("R 0");
    expect(formatMoney("abc")).toBe("R 0");
  });

  it("keeps the sign of negative amounts", () => {
    expect(formatMoney(-1500)).toBe("R -1 500");
  });
});
