# LGNDRY.Co — Homepage Body Design Spec
**Date:** 2026-07-01
**Scope:** Everything on `index.html` after the existing hero + nav panel — editorial intro, philosophy, scattered photo moments, companies, services, closing statement
**Stack:** Pure static HTML / CSS / JS — no dependencies, no build step

---

## 1. Design Philosophy

The homepage body reads like a photography journal, not an agency page. Sections are asymmetric, spaced generously, and never grid-locked. Photos are scattered through the page individually — paired one at a time with a short line of text — rather than clustered into a gallery block. The page should feel like flipping through a lookbook: quiet, uneven, confident.

Avoid: cards, borders, drop shadows, icon grids, centered symmetric blocks, more than one large image visible at the same scroll position.

---

## 2. Architecture

All new markup appends to `index.html` after the existing `.nav-panel` closing tag and before `<script>`. All new CSS appends to `assests/css/style.css`. All new JS appends to `assests/js/main.js` as a new IIFE, matching the existing nav IIFE pattern (ES5, `var`, no arrow functions, no template literals).

No new files. No new images — every image referenced below already exists in `assests/images/art/outdoor/` (top-level only; the `border/` subfolder is excluded — those files have baked-in text captions).

### Images used (all from `assests/images/art/outdoor/`, no subfolder)

| Key | File | Orientation | Used in |
|---|---|---|---|
| `tree` | `InShot_20240602_184217752.jpg` | Landscape | Editorial Intro |
| `tractor` | `InShot_20241224_173743706.jpg` | Landscape | Moment: Motion |
| `church` | `InShot_20250606_193143254.jpg` | Portrait | Philosophy |
| `sticks` | `InShot_20260211_201611759.jpg` | Portrait | Moment: Stillness |
| `cattle` | `InShot_20240821_203154916.jpg` | Landscape | Moment: Texture |
| `rocks` | `InShot_20260118_233430615.jpg` | Landscape | Closing Statement |

### Client logos used (all from `assests/images/client logos/`)

| File | Company |
|---|---|
| `vw.png` | Volkswagen |
| `kitso-logo.png` | Kitsotlhale Trading Pty Ltd |
| `capricorn-fm.b6efb469.jpg` | Capricorn FM |

---

## 3. Vertical Rhythm

Every top-level section in this spec (`.intro`, each `.moment`, `.philosophy`, `.companies`, `.services`, `.closing`) gets `margin: 120px 0` (`64px 0` on mobile, per §7) so no two sections ever crowd each other regardless of content height. This is the section's own margin, not a wrapping container's padding — sections remain independent blocks.

---

## 4. Color & Typography

Reuse existing `:root` variables — no new colors introduced. Reuse existing fonts: **Cormorant Garamond** (weight 300, headings/copy lines) and **Inter** (weight 300, any supporting small text/labels).

```css
--bg-primary:   #FFFFFF;
--text-primary: #1D1D1D;
--text-secondary: #7A746E;
--border:       #E5E0D9;
```

---

## 5. Section-by-Section Spec

### 5.1 Editorial Intro (`.intro`)

Directly follows the hero. Large negative space above and below. Copy sits left-aligned at roughly 30% viewport width; the `tree` image bleeds off the right edge of the viewport (`width: 55vw`, positioned so its right edge exceeds `100vw`, cropped by `overflow-x: hidden` on `body`, already present).

Copy (final, lightly polished from brief):

> **LGNDRY.Co captures the beauty hidden inside ordinary moments.**

Typography: Cormorant Garamond 300, `clamp(2rem, 4.5vw, 3.5rem)`, line-height 1.3, max-width `14ch` so it wraps to 2–3 lines naturally.

Layout: `.intro` is `position: relative`, min-height `80vh`. `.intro__text` is `position: absolute`, `left: 8vw`, vertically centered. `.intro__image` is `position: absolute`, `right: -10vw`, `top: 10%`, `width: 55vw`, `height: 70vh`, `object-fit: cover`.

### 5.2 Moment: Motion (`.moment.moment--motion`)

Small, left-aligned. Image `tractor` at `width: 38vw`, `height: 50vh`, positioned `left: 6vw`. Caption sits to the image's right, vertically centered against the image, Cormorant Garamond weight 300, italic, `1.5rem`, single word:

> *Motion.*

Section `min-height: 60vh`.

### 5.3 Philosophy (`.philosophy`)

Copy fragment offset — not centered. Two uneven lines, left third of viewport, `top: 15%`. The `church` image sits opposite corner (`right: 10vw`, `bottom: 10%`), small (`width: 28vw`), partially cropped by viewport edge on the right side (`right: -5vw` so it bleeds off-screen slightly).

Copy (lightly polished from brief), broken into two lines of uneven length rather than one centered paragraph:

> **We document people, places, textures, stillness, motion —**
> **finding beauty where most people simply pass by.**

Typography: Cormorant Garamond 300, `clamp(1.5rem, 3vw, 2.25rem)`, line-height 1.5.

### 5.4 Moment: Stillness (`.moment.moment--stillness`)

Large, right-aligned (mirrors Motion's left alignment for rhythm). Image `sticks` at `width: 34vw`, `height: 65vh` (its portrait orientation supports the tallest moment image), positioned `right: 6vw`. Caption sits to the image's left, same typographic treatment as §5.2:

> *Stillness.*

### 5.5 Moment: Texture (`.moment.moment--texture`)

Smaller and offset — breaks the left/right/left rhythm deliberately by sitting slightly left-of-center rather than fully left. Image `cattle` at `width: 30vw`, `height: 40vh`, positioned `left: 18vw`. Caption above the image (not beside it, for variation), small, `1.25rem`:

> *Texture.*

### 5.6 Companies Worked With (`.companies`)

Section label: **"Selected Collaborations."** (Cormorant Garamond, `1.75rem`, left-aligned, `margin-bottom: 80px`).

Three logos, staggered horizontally with uneven vertical offsets — not a straight row:

| Logo | Horizontal position | Vertical offset |
|---|---|---|
| `vw.png` | left third | baseline |
| `kitso-logo.png` | center third | `-24px` (sits higher) |
| `capricorn-fm.b6efb469.jpg` | right third | `+16px` (sits lower) |

Each logo: `max-width: 140px`, `filter: grayscale(1)`, `opacity: 0.75`. On hover: `filter: grayscale(0)`, `opacity: 1`, `transition: filter 0.4s ease, opacity 0.4s ease`.

### 5.7 Services (`.services`)

Six items, staggered text blocks down the page (not a grid, not cards):

1. Photography
2. Visual Direction
3. Brand Campaigns
4. Event Coverage
5. Product & Lifestyle Shoots
6. Creative Storytelling

Each item alternates left/right indentation (odd items `margin-left: 0`, even items `margin-left: 20vw`), Cormorant Garamond 300, `clamp(1.75rem, 3.5vw, 2.5rem)`, `padding: 32px 0`. On hover: a `1px` underline draws in from the left over `0.4s ease` (a `::after` pseudo-element, `width: 0` at rest, `width: 100%` on hover, `border-bottom: 1px solid var(--text-primary)`).

No links, no navigation — purely text-led per your confirmation.

### 5.8 Closing Statement (`.closing`)

Full-width (not full-bleed — respects existing page margins), image `rocks` at `width: 100%`, `height: 80vh`, `object-fit: cover`. Copy overlays the lower third of the image on a subtle scrim (`linear-gradient(transparent, rgba(0,0,0,0.35))`) so white text stays legible:

> **Not everything beautiful asks for attention. Some things simply wait to be noticed.**

Typography: Cormorant Garamond 300, `clamp(1.75rem, 4vw, 3rem)`, color `#FFFFFF`, centered within the image, generous padding.

---

## 6. Motion & Scroll Reveal

New IIFE in `main.js`, ES5 style matching existing code:

- `IntersectionObserver` watches every element with class `.reveal` (applied to `.intro__text`, `.intro__image`, each `.moment`, `.philosophy__text`, `.philosophy__image`, `.companies`, each `.services__item`, `.closing`).
- Threshold `0.2`. On intersect, add `.reveal--visible`, then `unobserve` (reveals happen once, not on every scroll pass).
- CSS: `.reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.9s ease-out, transform 0.9s ease-out; }` / `.reveal--visible { opacity: 1; transform: translateY(0); }`.
- `prefers-reduced-motion: reduce` — JS still adds `.reveal--visible` immediately (no observer delay), CSS removes the transition entirely (reuses the existing pattern already in the codebase for the loader/hero).

---

## 7. Responsive Behavior

### Tablet (768–1023px)

- `.intro__image`, `.philosophy__image`, and all `.moment` images scale to `70vw` regardless of their desktop width, keeping aspect ratio via `height: auto`.
- `.services__item` even-indexed `margin-left` reduces from `20vw` to `8vw`.
- Section `margin` (§3) reduces from `120px` to `80px`.

### Mobile (<768px)

- All absolutely-positioned elements (`.intro__text`/`.intro__image`, `.philosophy__text`/`.philosophy__image`) switch to normal document flow (`position: static`), stacking image-then-text or text-then-image per section, full-width images (`width: 100%`).
- `.moment` layouts stack (image full-width, caption below, centered).
- `.companies` logos: stack vertically, centered, uniform spacing (stagger offsets removed).
- `.services__item` even-indexed `margin-left` resets to `0` — all items left-aligned on mobile.
- `.closing` image height reduces to `50vh`.
- Section `margin` (§3) reduces to `64px`.

---

## 8. Accessibility

- All decorative images (`tree`, `tractor`, `church`, `sticks`, `cattle`, `rocks`) use `alt=""` since they're paired with explicit adjacent text conveying the same idea — content is not lost to screen reader users.
- Client logos use descriptive `alt` text (`"Volkswagen"`, `"Kitsotlhale Trading"`, `"Capricorn FM"`).
- `.reveal` elements are visible by default in the DOM (not `display:none`) so content is accessible even if JS fails or before the observer fires — only `opacity`/`transform` are animated.
- Heading hierarchy: use `<h2>` for the intro copy, `<h2>` for the philosophy copy, `<h3>` for each moment caption, `<h2>` for "Selected Collaborations", `<h2>` for "Services", `<h2>` for the closing statement.

---

## 9. Out of Scope

- Individual work/case-study pages (already exist as separate nav destinations)
- CMS or dynamic content loading — all copy and images are static/hardcoded
- Image lazy-loading (page is short enough that all images are near-viewport already)
- Analytics or form functionality
- Any changes to the existing hero, nav, or loader sections
