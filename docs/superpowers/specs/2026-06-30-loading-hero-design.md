# LGNDRY.Co — Loading Screen & Hero Section Design Spec
**Date:** 2026-06-30  
**Scope:** `index.html` loading experience + homepage hero section  
**Stack:** Pure static HTML / CSS / JS — no dependencies, no build step

---

## 1. Color Palette (CSS Variables)

All color values must reference these variables. No hardcoded hex values except where defining the variables themselves.

```css
:root {
  --bg-primary:       #FFFFFF;
  --bg-secondary:     #F7F5F2;
  --surface:          #FCFBF9;
  --surface-elevated: #F1EEE9;

  --text-primary:     #1D1D1D;
  --text-secondary:   #7A746E;
  --text-disabled:    #A8A097;

  --border:           #E5E0D9;
  --divider:          #D9D4CD;

  --primary:          #1D1D1D;
  --primary-hover:    #121212;
  --secondary:        #FFFFFF;
  --secondary-hover:  #F7F5F2;
}
```

Photography provides all chromatic colour. No accent colours, gradients, or decorative tones are to be introduced.

---

## 2. Typography

Loaded via Google Fonts (single `<link>` in `<head>`):

| Role | Font | Weight(s) |
|---|---|---|
| Display / logo text | Cormorant Garamond | 300, 400 |
| Body / UI | Inter | 300, 400 |

- Headings: `font-family: 'Cormorant Garamond', serif`
- Body: `font-family: 'Inter', sans-serif`
- No system font fallbacks with strong personality (use `serif` / `sans-serif` only)

---

## 3. File Structure

```
index.html
assests/
  css/
    style.css       ← all styles (reset, variables, loader, hero)
  js/
    main.js         ← animation sequencer (~50 lines, no dependencies)
  images/
    hero-image.JPG  ← hero background
  logos/
    LGNDRY.CO Final.png         ← black logo (used in hero over light sky)
    LGNDRY.CO Final white.png   ← white logo (reserved for dark-bg contexts)
docs/
  superpowers/specs/
    2026-06-30-loading-hero-design.md
```

---

## 4. Loading Screen

### 4.1 Behaviour

- Triggered on `index.html` load only.
- `sessionStorage` flag (`lgndry_loaded`) prevents replay within the same browser session.
- If flag is already set: loader is hidden instantly (`display: none`), hero is immediately visible.

### 4.2 Visual Spec

| Property | Value |
|---|---|
| Position | `fixed`, full viewport, `z-index: 1000` |
| Background | `var(--bg-primary)` — #FFFFFF |
| Content | LGNDRY.Co wordmark, centered horizontally and vertically |
| Wordmark colour | `var(--text-primary)` — #1D1D1D |
| Wordmark font | Cormorant Garamond, weight 300 |
| Wordmark size | `clamp(2rem, 6vw, 4rem)` |

### 4.3 Animation Sequence

All animation is CSS `@keyframes` + `transition`. JS only toggles classes and sets the sessionStorage flag.

**Phase 1 — Compress & Reveal (0s → 0.5s)**
- Wordmark fades in from `opacity: 0` to `opacity: 1`
- Starts with `letter-spacing: -0.55em` — letters overlap, appear stacked as one glyph
- Easing: `ease-out`

**Phase 2 — Spread (0.5s → 1.4s)**
- `letter-spacing` eases from `-0.55em` to `0.25em` (natural open tracking)
- Letters separate outward, wordmark assembles
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` — fast initial spread, soft landing

**Hold (1.4s → 2.2s)**
- Wordmark rests at full tracking. Intentional editorial silence.

**Curtain Lift (2.2s → 3.1s)**
- Loader div transitions `transform: translateY(0)` → `translateY(-100%)`
- Duration: `0.9s`
- Easing: `cubic-bezier(0.77, 0, 0.175, 1)` — slow start, sharp decisive exit
- After transition ends: JS sets `sessionStorage` flag, sets loader to `display: none`

**Total duration:** ~3.1 seconds on first load, 0 seconds on subsequent session navigations.

### 4.4 Implementation Notes

- The wordmark in the loader is live text (`<span>` characters), not the PNG logo. This enables letter-spacing animation.
- `will-change: transform, opacity` on the loader element for GPU acceleration.
- The hero section is fully rendered in the DOM before the loader lifts — no paint on reveal.

---

## 5. Hero Section

### 5.1 Layout

```
┌──────────────────────────────────────────────┐
│  [hazy overexposed sky — ~top 40%]           │
│                                              │
│      [LGNDRY.Co logo — black PNG]            │  ← 80px from top, centered
│                                              │
│            [woman in white dress]            │  ← natural subject position
│                                              │
│    "Found Beauty in the Mundane."            │  ← ~72% from top, centered
│                                              │
└──────────────────────────────────────────────┘
```

### 5.2 Visual Spec

| Property | Value |
|---|---|
| Height | `100vh` |
| Background image | `assests/images/hero-image.JPG` |
| Image fit | `object-fit: cover` |
| Image position | `object-position: center` (desktop), `55% center` (mobile) |
| Image element | `<img>` inside `.hero` — not CSS background-image (enables zoom animation on element) |

**Logo:**
| Property | Value |
|---|---|
| Asset | `assests/logos/LGNDRY.CO Final.png` (black version) |
| Position | Absolute, centered horizontally, `top: 80px` |
| Width | `140px` desktop / `100px` mobile |
| Colour rationale | Sits over the light sky area — black logo reads cleanly without overlay |

**Tagline:**
| Property | Value |
|---|---|
| Text | `Found Beauty in the Mundane.` |
| Position | Absolute, centered horizontally, `top: 72%` |
| Font | Cormorant Garamond, weight 300 |
| Size | `clamp(0.85rem, 1.5vw, 1.1rem)` |
| Colour | `var(--secondary)` — #FFFFFF |
| Letter-spacing | `0.2em` |
| Colour rationale | Sits over warm dark grass tones — white reads with natural contrast, no overlay needed |

### 5.3 Hero Zoom Animation

Applied to the `<img>` element (not the container):

```css
@keyframes heroZoom {
  from { transform: scale(1.00); }
  to   { transform: scale(1.06); }
}

.hero__image {
  animation: heroZoom 10s cubic-bezier(0.2, 0, 0.4, 1) forwards;
  animation-delay: 2.0s; /* begins as curtain starts lifting (2.2s), so image breathes on first reveal */
}
```

- `forwards` fill — animation stops at final scale, never loops.
- `animation-delay: 2.8s` — zoom begins only after the curtain has lifted, so the motion is felt as a slow reveal, not a background that's already moving.
- `transform-origin: center center`

### 5.4 No-Overlay Policy

No colour overlays, gradients, or tints are applied to the hero image. The image's natural tonal range (overexposed sky above, dark amber below) provides legibility for both the black logo and white tagline without modification. This aligns with the brand directive: "Photography provides the colour throughout the website."

---

## 6. Responsive Breakpoints

| Breakpoint | Logo width | Tagline size | Image position |
|---|---|---|---|
| Desktop (≥1024px) | 140px | `clamp(0.85rem, 1.5vw, 1.1rem)` | `center` |
| Tablet (640–1023px) | 120px | `0.95rem` | `center` |
| Mobile (<640px) | 100px | `0.85rem` | `55% center` |

On mobile, `object-position: 55% center` nudges the frame slightly right to keep the subject visible. Tagline moves to `top: 78%` on mobile to clear the subject.

---

## 7. Performance Requirements

- GPU-accelerated animations only: `transform` and `opacity` — no `width`, `height`, `top`, `left`, or `font-size` animations.
- `will-change: transform` on `.loader` and `.hero__image`.
- Google Fonts loaded with `display=swap` to prevent FOIT.
- Hero image is above-the-fold — no lazy loading on this element.
- All animation timing functions use `cubic-bezier` curves — no `linear` or `ease` defaults.

---

## 8. Accessibility

- `prefers-reduced-motion` media query: if set, skip all animations. Loader hides immediately, hero image is static (no zoom).
- Logo `<img>` has `alt="LGNDRY.Co"`.
- Hero section has `role="banner"`.

---

## 9. Out of Scope

- Navigation / menu
- Scroll-triggered animations
- Any page other than `index.html`
- CMS, build tools, or frameworks
