import { describe, expect, it } from "vitest";
import {
  clamp,
  galleryFrame,
  GALLERY_HOLD,
  heroFrame,
  smooth,
} from "@/components/site/scroll-math";

describe("clamp / smooth", () => {
  it("clamps to the range", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });

  it("smoothstep is 0 at 0, 1 at 1, 0.5 at the midpoint, and monotonic", () => {
    expect(smooth(0)).toBe(0);
    expect(smooth(1)).toBe(1);
    expect(smooth(0.5)).toBe(0.5);
    expect(smooth(0.3)).toBeLessThan(smooth(0.6));
  });
});

describe("heroFrame", () => {
  it("starts untouched", () => {
    expect(heroFrame(0)).toEqual({ fade: 0, scale: 1, blur: 0 });
  });

  it("ends fully faded, zoomed to 1.22 and blurred by 12px", () => {
    const end = heroFrame(1);
    expect(end.fade).toBe(1);
    expect(end.scale).toBeCloseTo(1.22, 10);
    expect(end.blur).toBeCloseTo(12, 10);
  });

  it("text is gone after the first quarter, before the blur begins", () => {
    const quarter = heroFrame(0.25);
    expect(quarter.fade).toBe(1);
    expect(quarter.blur).toBe(0);
  });

  it("never scales down or un-blurs as progress increases", () => {
    let previous = heroFrame(0);
    for (let p = 0.05; p <= 1.0001; p += 0.05) {
      const frame = heroFrame(p);
      expect(frame.scale).toBeGreaterThanOrEqual(previous.scale);
      expect(frame.blur).toBeGreaterThanOrEqual(previous.blur);
      expect(frame.fade).toBeGreaterThanOrEqual(previous.fade);
      previous = frame;
    }
  });
});

describe("galleryFrame (5 images)", () => {
  it("opens on the first image and first copy", () => {
    const frame = galleryFrame(0, 5);
    expect(frame.primary).toBe(0);
    expect(frame.activeCopy).toBe(0);
    expect(frame.images[0]).toEqual({ opacity: 1, scale: 1, drift: 0 });
    expect(frame.images[1]?.opacity).toBe(0);
  });

  it("holds the current image before dissolving into the next", () => {
    // 4 transitions over 0..1, so each unit is 0.25; 0.5 through the hold.
    const holding = galleryFrame(0.25 * (GALLERY_HOLD / 2), 5);
    expect(holding.primary).toBe(0);
    expect(holding.images[1]?.opacity).toBe(0);
  });

  it("dissolves and advances the copy once the hold is spent", () => {
    const dissolving = galleryFrame(0.25 * 0.9, 5);
    expect(dissolving.images[1]?.opacity).toBeGreaterThan(0);
    expect(dissolving.activeCopy).toBe(1);
  });

  it("finishes on the last image and last copy without indexing out of range", () => {
    const end = galleryFrame(1, 5);
    expect(end.primary).toBe(4);
    expect(end.activeCopy).toBe(4);
    expect(end.images).toHaveLength(5);
    expect(end.images[4]?.opacity).toBe(1);
  });

  it("returns one frame per image and only ever shows two at once", () => {
    for (let p = 0; p <= 1.0001; p += 0.037) {
      const frame = galleryFrame(Math.min(p, 1), 5);
      expect(frame.images).toHaveLength(5);
      expect(frame.images.filter((image) => image.opacity > 0).length).toBeLessThanOrEqual(2);
    }
  });
});
