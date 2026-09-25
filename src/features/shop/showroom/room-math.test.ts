import { describe, expect, it } from "vitest";
import { SPACES, frameKey, placement, printSize } from "@/features/shop/showroom/room-math";

const living = SPACES[0]!;

describe("printSize", () => {
  it("reads centimetres from common size labels", () => {
    expect(printSize("50 × 70 cm", null)).toEqual({ width: 70, height: 50 });
    expect(printSize("135.1x90cm", null)).toEqual({ width: 135.1, height: 90 });
    expect(printSize("60,5 x 40 cm", null)).toEqual({ width: 60.5, height: 40 });
  });

  it("turns the print to portrait for a portrait image", () => {
    expect(printSize("50 × 70 cm", { width: 900, height: 1200 })).toEqual({
      width: 50,
      height: 70,
    });
  });

  it("falls back to a stand-in when no size is readable", () => {
    expect(printSize("Standard edition", null)).toEqual({ width: 100, height: 67 });
    expect(printSize("", null)).toEqual({ width: 100, height: 67 });
    expect(printSize("70 cm", null)).toEqual({ width: 100, height: 67 });
  });
});

describe("placement", () => {
  it("scales the print against the wall and reports its proportions", () => {
    // 90 × 60 landscape print on a 360 cm wall = 0.25 of the wall; the height allowance is higher.
    const result = placement(living, 1.5, "60 × 90 cm", { width: 3000, height: 2000 });
    expect(result).toEqual({ scale: "0.250", ratio: "1.5000" });
  });

  it("never exceeds the room's height allowance", () => {
    // A very wide print would want scale 0.75, but a 4:3 scene caps it by height.
    const result = placement(living, 4 / 3, "300 × 400 cm", { width: 2000, height: 3000 });
    expect(Number(result.scale)).toBeCloseTo((living.maxHeight * (2000 / 3000)) / (4 / 3), 3);
  });

  it("stays within 10% and 75% of the photo", () => {
    expect(Number(placement(living, 1.5, "1 × 1 cm", null).scale)).toBe(0.1);
    expect(
      Number(placement(living, 1.5, "900 × 900 cm", { width: 1000, height: 1000 }).scale),
    ).toBeLessThanOrEqual(0.75);
  });

  it("uses the size label's own proportions until the image has loaded", () => {
    expect(placement(living, 1.5, "50 × 100 cm", null).ratio).toBe("2.0000");
  });
});

describe("frameKey", () => {
  it("keys on the first word, lower-cased", () => {
    expect(frameKey("Oak Frame")).toBe("oak");
    expect(frameKey("Unframed")).toBe("unframed");
  });
});
