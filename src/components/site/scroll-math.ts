// Pure maths behind the homepage's scroll-driven effects, ported unchanged
// from the legacy main.js so the motion is identical. Kept free of DOM/React
// so it can be unit-tested.

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Smoothstep: eases 0..1 in and out. */
export function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export type HeroFrame = {
  /** 0 = text fully shown, 1 = text fully faded/drifted away. */
  fade: number;
  /** Image scale, 1 → 1.22. */
  scale: number;
  /** Image blur in px, 0 → 12. */
  blur: number;
};

/** `progress` is 0..1 scroll progress through the hero's scroll runway. */
export function heroFrame(progress: number): HeroFrame {
  // Phase 1 — content exit: fade + drift upward over the first quarter.
  const fade = smooth(clamp(progress / 0.25, 0, 1));
  // Phase 2 — slow zoom: begins as the text departs, runs to the end.
  const zoom = smooth(clamp((progress - 0.2) / 0.8, 0, 1));
  // Phase 3 — cinematic blur: builds through the final stretch of the zoom.
  const blur = smooth(clamp((progress - 0.55) / 0.45, 0, 1)) * 12;
  return { fade, scale: 1 + zoom * 0.22, blur };
}

/**
 * Fraction of each image's scroll "unit" spent holding on the image before it
 * begins dissolving into the next. Higher = each photo lingers longer.
 */
export const GALLERY_HOLD = 0.6;

export type GalleryImageFrame = { opacity: number; scale: number; drift: number };

export type GalleryFrame = {
  images: GalleryImageFrame[];
  /** Index of the image that currently "owns" the stage. */
  primary: number;
  /** Index of the copy block that should be showing. */
  activeCopy: number;
};

/** `progress` is 0..1 scroll progress through the pinned gallery section. */
export function galleryFrame(progress: number, imageCount: number): GalleryFrame {
  const maxIndex = Math.max(imageCount - 1, 1);

  // Position along the image sequence, 0 .. maxIndex.
  const exact = progress * maxIndex;
  let current = Math.floor(exact);
  if (current >= maxIndex) current = maxIndex - 1;
  const frac = exact - current; // 0..1 within current -> next
  const next = current + 1;

  // Hold on the current image, then ease the dissolve to the next.
  const raw = frac <= GALLERY_HOLD ? 0 : (frac - GALLERY_HOLD) / (1 - GALLERY_HOLD);
  const blend = smooth(clamp(raw, 0, 1)); // 0 = current, 1 = next

  const images: GalleryImageFrame[] = [];
  for (let j = 0; j < imageCount; j++) {
    if (j === current) {
      // Held image: fully opaque underneath, slow Ken Burns zoom.
      images.push({ opacity: 1, scale: 1 + frac * 0.045, drift: 0 });
    } else if (j === next) {
      // Incoming image: fades in on top and settles from a touch larger.
      images.push({ opacity: blend, scale: 1.06 - blend * 0.06, drift: (1 - blend) * 14 });
    } else {
      images.push({ opacity: 0, scale: 1.04, drift: 0 });
    }
  }

  return {
    images,
    primary: blend < 0.5 ? current : next,
    // Advance the copy as soon as the dissolve begins, so the new words
    // arrive with the new photograph.
    activeCopy: frac <= GALLERY_HOLD ? current : next,
  };
}
