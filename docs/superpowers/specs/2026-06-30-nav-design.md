# LGNDRY.Co — Editorial Navigation Design Spec
**Date:** 2026-06-30
**Scope:** Site-wide navigation — trigger, overlay panel, photography preview, animations
**Stack:** Pure static HTML / CSS / JS — no dependencies, no build step

---

## 1. Design Philosophy

The navigation resembles an editorial publication page or exhibition catalogue entering the user's field of view. It is minimal, slow, and confident. Every interaction communicates craftsmanship and restraint.

Avoid: hamburger icons, rounded cards, heavy shadows, bright accent colours, generic drawer animations, bouncy micro-interactions.

---

## 2. Color Palette

All values reference existing CSS custom properties from `:root`. One new value is introduced for the photography column:

```css
--nav-dark: #0D0D0D; /* near-black for right photography column */
```

No other new colours. No hardcoded hex values elsewhere in navigation CSS.

---

## 3. File Structure

```
index.html              ← nav markup added here
assests/
  css/
    style.css           ← nav styles appended here
  js/
    main.js             ← nav JS appended here
```

No new files. All navigation code is added to the existing three files.

---

## 4. Navigation Trigger

### 4.1 Markup

A `<nav>` element is added to `index.html` directly after `<body>`, before the loader div. It contains one `<button>`:

```html
<nav class="site-nav" aria-label="Site navigation">
  <button class="site-nav__trigger" id="navTrigger" aria-expanded="false" aria-controls="navPanel">
    Menu
  </button>
</nav>
```

### 4.2 Visual Spec

| Property | Value |
|---|---|
| Position | `fixed`, top-left, `z-index: 600` (above panel) |
| Padding | `24px 32px` |
| Font | Cormorant Garamond, weight 300 |
| Size | `0.85rem` |
| Colour | `var(--text-primary)` |
| Letter-spacing | `0.2em` |
| Text transform | `uppercase` |
| Background | none (transparent over hero) |
| Border | none |
| Cursor | `pointer` |

### 4.3 Hover State

```css
.site-nav__trigger:hover {
  opacity: 0.5;
  transition: opacity 0.3s ease;
}
```

No underline, no colour change, no scale.

---

## 5. Navigation Panel

### 5.1 Markup

```html
<div class="nav-panel" id="navPanel" aria-hidden="true">
  <div class="nav-panel__links">
    <button class="nav-panel__close" id="navClose">Close</button>
    <ul class="nav-panel__list">
      <li><a class="nav-panel__item" href="index.html" data-nav-image="home">Home</a></li>
      <li><a class="nav-panel__item" href="commercial.html" data-nav-image="work">Work</a></li>
      <li><a class="nav-panel__item" href="services.html" data-nav-image="services">Services</a></li>
      <li><a class="nav-panel__item" href="journal.html" data-nav-image="journal">Journal</a></li>
      <li><a class="nav-panel__item" href="about.html" data-nav-image="about">About</a></li>
      <li><a class="nav-panel__item" href="contact.html" data-nav-image="contact">Contact</a></li>
    </ul>
  </div>
  <div class="nav-panel__preview" aria-hidden="true">
    <img class="nav-panel__photo nav-panel__photo--active" data-nav-photo="home"     src="assests/images/hero-image.JPG"                                               alt="">
    <img class="nav-panel__photo" data-nav-photo="work"     src="assests/images/commercial/vw/InShot_20250729_025522317.jpg"                   alt="">
    <img class="nav-panel__photo" data-nav-photo="services" src="assests/images/commercial/kitso/LGNDRY.CO_14 copy.jpg"                        alt="">
    <img class="nav-panel__photo" data-nav-photo="journal"  src="assests/images/art/outdoor/InShot_20250718_221120888.jpg"                     alt="">
    <img class="nav-panel__photo" data-nav-photo="about"    src="assests/images/art/studio art/InShot_20250826_095246113.jpg"                  alt="">
    <img class="nav-panel__photo" data-nav-photo="contact"  src="assests/images/art/outdoor/border/InShot_20251211_113101465.jpg"              alt="">
  </div>
</div>
```

All preview `<img>` elements have empty `alt=""` — they are decorative.

### 5.2 Panel Dimensions

| Breakpoint | Panel width | Layout |
|---|---|---|
| Desktop (≥1024px) | `92vw` | Two columns, 50/50 |
| Tablet (640–1023px) | `96vw` | Two columns, 50/50 |
| Mobile (<640px) | `100vw` | Single column, photography as ghost background |

### 5.3 Panel CSS

```css
.nav-panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 92vw;
  height: 100vh;
  z-index: 500;
  display: flex;
  transform: translateX(-100%);
  transition: transform 0.8s cubic-bezier(0.76, 0, 0.24, 1);
  will-change: transform;
}

.nav-panel--open {
  transform: translateX(0);
}
```

### 5.4 Column CSS

```css
.nav-panel__links {
  width: 50%;
  height: 100%;
  background-color: var(--bg-primary);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 80px 60px;
  position: relative;
}

.nav-panel__preview {
  width: 50%;
  height: 100%;
  background-color: var(--nav-dark);
  position: relative;
  overflow: hidden;
}
```

---

## 6. Navigation Links

### 6.1 Typography

| Property | Value |
|---|---|
| Font | Cormorant Garamond, weight 300 |
| Size | `clamp(2.8rem, 5vw, 5rem)` |
| Line-height | `1.6` |
| Letter-spacing | `-0.01em` |
| Colour | `var(--text-primary)` |
| List style | none |
| Text decoration | none |

### 6.2 Stagger Reveal

Links start hidden and animate in after the panel arrives:

```css
.nav-panel__item {
  display: block;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}
```

JS adds `.nav-panel__item--visible` to each link sequentially starting at `500ms` after panel open, with `80ms` between each:

```css
.nav-panel__item--visible {
  opacity: 1;
  transform: translateY(0);
}
```

On close, all `.nav-panel__item--visible` classes are removed immediately before the panel retreats.

### 6.3 Hover State

Hover state is applied via JS (`mousenter` / `mouseleave` on the `<ul>`), adding `.nav-panel__list--hovering` to the list and `.nav-panel__item--hovered` to the active link:

```css
/* Dim all links when any is hovered */
.nav-panel__list--hovering .nav-panel__item {
  opacity: 0.25;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

/* Restore hovered link */
.nav-panel__list--hovering .nav-panel__item--hovered {
  opacity: 1;
  transform: translateX(6px);
}
```

No underlines, no colour changes, no scale.

---

## 7. Close Trigger

```css
.nav-panel__close {
  position: absolute;
  top: 24px;
  left: 32px;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.nav-panel__close:hover {
  opacity: 0.5;
  transition: opacity 0.3s ease;
}
```

---

## 8. Photography Preview

### 8.1 Image Stack

All six images are stacked absolutely within `.nav-panel__preview`:

```css
.nav-panel__photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  opacity: 0;
  transition: opacity 0.6s ease;
}

.nav-panel__photo--active {
  opacity: 1;
}
```

### 8.2 Image Mapping

| Nav item | `data-nav-image` | `data-nav-photo` | Image path |
|---|---|---|---|
| Home | `home` | `home` | `assests/images/hero-image.JPG` |
| Work | `work` | `work` | `assests/images/commercial/vw/InShot_20250729_025522317.jpg` |
| Services | `services` | `services` | `assests/images/commercial/kitso/LGNDRY.CO_14 copy.jpg` |
| Journal | `journal` | `journal` | `assests/images/art/outdoor/InShot_20250718_221120888.jpg` |
| About | `about` | `about` | `assests/images/art/studio art/InShot_20250826_095246113.jpg` |
| Contact | `contact` | `contact` | `assests/images/art/outdoor/border/InShot_20251211_113101465.jpg` |

Default (no hover): `home` image is active.

### 8.3 Crossfade Behaviour

JS removes `.nav-panel__photo--active` from the current image and adds it to the target image on `mouseenter`. On `mouseleave` from the list, restores `home` image as active.

---

## 9. Open / Close Sequence

### 9.1 Opening

1. JS adds `.nav-panel--open` to panel → panel slides in (`800ms`)
2. Set `aria-expanded="true"` on trigger, `aria-hidden="false"` on panel
3. After `500ms`: add `.nav-panel__item--visible` to each link, `80ms` apart
4. Set `#navTrigger` to `opacity: 0; pointer-events: none` — it sits behind the panel visually but hiding it cleanly avoids layout shift
5. Trap focus within panel

### 9.2 Closing

1. Remove `.nav-panel__item--visible` from all links instantly
2. After `100ms`: remove `.nav-panel--open` from panel → panel retreats (`700ms`)
3. Set `aria-expanded="false"` on trigger, `aria-hidden="true"` on panel
4. Restore `#navTrigger` visibility
5. Restore focus to trigger
6. Reset photography to `home` image

### 9.3 Close Triggers

- Click `.nav-panel__close`
- Press `Escape` key
- Click the ~8% page strip visible at the right edge (click outside panel)

---

## 10. Responsive Behaviour

### 10.1 Tablet (640–1023px)

```css
@media (max-width: 1023px) {
  .nav-panel { width: 96vw; }
  .nav-panel__links { padding: 60px 40px; }
  .nav-panel__item { font-size: clamp(2rem, 4vw, 3rem); }
}
```

### 10.2 Mobile (<640px)

```css
@media (max-width: 639px) {
  .nav-panel {
    width: 100vw;
    flex-direction: column;
  }

  .nav-panel__links {
    width: 100%;
    height: 100%;
    padding: 80px 32px;
    position: relative;
    z-index: 1;
  }

  .nav-panel__preview {
    display: none; /* photography becomes ghost background via JS */
  }

  .nav-panel__item { font-size: clamp(2.2rem, 8vw, 3rem); }
}
```

On mobile, JS dynamically sets the currently-hovered (or default) image as a CSS background on `.nav-panel__links` at `opacity: 0.12` — atmospheric, non-competing. This replaces the right-column preview.

---

## 11. Accessibility

- `aria-expanded` on trigger reflects open/closed state
- `aria-hidden` on panel reflects open/closed state
- `aria-label="Site navigation"` on `<nav>`
- `Escape` key closes panel
- Focus trapped inside panel when open; restored to trigger on close
- `prefers-reduced-motion`: all transitions and stagger delays set to `0ms` — panel appears/disappears instantly

---

## 12. Performance

- `will-change: transform` on `.nav-panel`
- All animations use `transform` and `opacity` only — no layout-triggering properties
- Photography images are not lazy-loaded (they are above-the-fold content once the panel opens)
- Panel exists in DOM at all times (`display: flex`, off-screen via transform) — no paint-on-open delay

---

## 13. z-index Stack

| Layer | z-index |
|---|---|
| Hero content | 1 |
| Nav panel | 500 |
| Nav trigger (`#navTrigger`) | 600 |
| Loader | 1000 |

---

## 14. Out of Scope

- Page transitions between nav links
- Active link highlighting (current page indicator)
- Sub-menus or dropdown items
- Search functionality
- Social links within the nav panel
