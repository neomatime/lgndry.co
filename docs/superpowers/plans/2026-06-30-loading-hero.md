# Loading Screen & Hero Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cinematic full-screen loading animation and full-viewport hero section for `index.html` using pure HTML, CSS, and vanilla JS — no dependencies, no build step.

**Architecture:** A CSS `@keyframes` loader compresses the wordmark then spreads it apart before a curtain-lift transition exposes the hero. A ~60-line IIFE in `main.js` sequences the timing, manages the `sessionStorage` flag, and toggles CSS classes. All colour values reference CSS custom properties defined in `style.css`.

**Tech Stack:** HTML5, CSS3 (custom properties, `@keyframes`, `clamp()`), vanilla JS (ES5-compatible IIFE), Google Fonts CDN (Cormorant Garamond + Inter).

## Global Constraints

- No hardcoded hex values in CSS — use only `var(--*)` tokens defined in `:root`.
- No external JS libraries, frameworks, or build tools.
- All animations use `transform` and `opacity` only — never animate `width`, `height`, `top`, `left`, or font properties mid-transition (except `letter-spacing` in the loader, which is CPU-cheap at small scale).
- `will-change: transform` on `.loader` and `.hero__image` only.
- Photography provides all chromatic colour — no gradients, tints, or decorative overlays on the hero.
- Google Fonts loaded with `display=swap` to prevent FOIT.
- Hero image (`assests/images/hero-image.JPG`) is above-the-fold — never lazy-load it.
- `sessionStorage` key: `lgndry_loaded`.
- File path: assets folder is spelled `assests/` (project convention — do not correct it).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `index.html` | Modify (currently empty) | HTML shell, both sections, font + CSS + JS links |
| `assests/css/style.css` | Create | CSS variables, reset, loader styles, hero styles, responsive, reduced-motion |
| `assests/js/main.js` | Create | Session check, animation sequence, class toggling |

---

### Task 1: HTML Shell + CSS Foundation

**Files:**
- Modify: `index.html`
- Create: `assests/css/style.css`

**Interfaces:**
- Produces: A working HTML page that loads Cormorant Garamond + Inter from Google Fonts and applies the base reset. Later tasks add markup into this shell and styles into this CSS file.

- [ ] **Step 1: Write `index.html` shell**

Replace the entire contents of `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LGNDRY.Co — Visual Storytelling Studio</title>
  <meta name="description" content="LGNDRY.Co is a visual storytelling studio creating photography, cinematic films, and original visual works.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Inter:wght@300;400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assests/css/style.css">
</head>
<body>

  <!-- CONTENT GOES HERE (Tasks 2 and 3) -->

  <script src="assests/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `assests/css/style.css`**

Create the file with:

```css
/* ─── Google Fonts are loaded via <link> in HTML ─── */

/* ─── Reset ─────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ─── CSS Variables ──────────────────────────────── */
:root {
  --bg-primary:        #FFFFFF;
  --bg-secondary:      #F7F5F2;
  --surface:           #FCFBF9;
  --surface-elevated:  #F1EEE9;

  --text-primary:      #1D1D1D;
  --text-secondary:    #7A746E;
  --text-disabled:     #A8A097;

  --border:            #E5E0D9;
  --divider:           #D9D4CD;

  --primary:           #1D1D1D;
  --primary-hover:     #121212;
  --secondary:         #FFFFFF;
  --secondary-hover:   #F7F5F2;
}

/* ─── Base ───────────────────────────────────────── */
html {
  font-family: 'Inter', sans-serif;
  font-weight: 300;
  color: var(--text-primary);
  background-color: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  overflow-x: hidden;
}
```

- [ ] **Step 3: Verify in browser**

Open `index.html` directly in Chrome or Firefox. Open DevTools → Network tab.

Expected:
- Two font requests to `fonts.googleapis.com` with status 200.
- Page background is pure white (`#FFFFFF`).
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html assests/css/style.css
git commit -m "feat: HTML shell and CSS foundation — variables, reset, fonts"
```

---

### Task 2: Loading Screen

**Files:**
- Modify: `index.html` (add loader markup inside `<body>`, before the script tag)
- Modify: `assests/css/style.css` (append loader styles)

**Interfaces:**
- Produces:
  - DOM element: `<div class="loader" id="loader">` — referenced by JS in Task 4 as `document.getElementById('loader')`
  - CSS classes consumed by JS: `.loader--exit` (triggers curtain lift), `.loader--hidden` (removes from paint)

- [ ] **Step 1: Add loader markup to `index.html`**

Inside `<body>`, before the `<!-- CONTENT GOES HERE -->` comment, add:

```html
  <!-- Loading screen -->
  <div class="loader" id="loader" aria-hidden="true">
    <div class="loader__wordmark">
      <span>L</span><span>G</span><span>N</span><span>D</span><span>R</span><span>Y</span><span>.</span><span>C</span><span>o</span>
    </div>
  </div>
```

- [ ] **Step 2: Append loader styles to `assests/css/style.css`**

```css
/* ─── Loader ─────────────────────────────────────── */
.loader {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}

.loader--exit {
  transform: translateY(-100%);
  transition: transform 0.9s cubic-bezier(0.77, 0, 0.175, 1);
}

.loader--hidden {
  display: none;
}

/* Wordmark: starts stacked (letter-spacing: -0.55em), fades in, then spreads */
.loader__wordmark {
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: clamp(2rem, 6vw, 4rem);
  color: var(--text-primary);
  letter-spacing: -0.55em;
  opacity: 0;
  animation:
    loaderFadeIn 0.5s ease-out forwards,
    loaderSpread 0.9s 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes loaderFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes loaderSpread {
  from { letter-spacing: -0.55em; }
  to   { letter-spacing: 0.25em;  }
}
```

- [ ] **Step 3: Verify in browser**

Open `index.html`. The page should show:
- Pure white full-screen overlay (loader covering everything).
- "LGNDRY.Co" fades in while letters are compressed together (appears as a single dense glyph), then spreads apart to full tracking over ~0.9s.
- Animation runs once automatically. Refreshing replays it.
- No scroll, no layout behind loader visible yet.

Confirm timing feels editorial — not rushed, not slow. Total wordmark animation is ~1.4s.

- [ ] **Step 4: Commit**

```bash
git add index.html assests/css/style.css
git commit -m "feat: loading screen — wordmark compress-and-spread animation"
```

---

### Task 3: Hero Section

**Files:**
- Modify: `index.html` (add hero markup after the loader div, before the script tag)
- Modify: `assests/css/style.css` (append hero styles)

**Interfaces:**
- Produces:
  - DOM element: `<section class="hero">` with `<img class="hero__image">` — JS adds `.hero__image--zoom` to the image to trigger the zoom animation.
  - CSS class consumed by JS: `.hero__image--zoom`

- [ ] **Step 1: Add hero markup to `index.html`**

After the `</div>` closing the `.loader`, add:

```html
  <!-- Hero section -->
  <section class="hero" role="banner">
    <img
      class="hero__image"
      src="assests/images/hero-image.JPG"
      alt="A figure stands in a golden field beneath a hazy sky — Limpopo, South Africa"
    >
    <div class="hero__content">
      <img
        class="hero__logo"
        src="assests/logos/LGNDRY.CO Final.png"
        alt="LGNDRY.Co"
        width="140"
      >
      <p class="hero__tagline">Found Beauty in the Mundane.</p>
    </div>
  </section>
```

- [ ] **Step 2: Append hero styles to `assests/css/style.css`**

```css
/* ─── Hero ───────────────────────────────────────── */
.hero {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.hero__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  will-change: transform;
  /* Zoom is NOT applied here — JS adds .hero__image--zoom at the right moment */
}

.hero__image--zoom {
  animation: heroZoom 10s cubic-bezier(0.2, 0, 0.4, 1) forwards;
}

@keyframes heroZoom {
  from { transform: scale(1.00); }
  to   { transform: scale(1.06); }
}

.hero__content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero__logo {
  width: 140px;
  margin-top: 80px;
}

.hero__tagline {
  position: absolute;
  top: 72%;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: clamp(0.85rem, 1.5vw, 1.1rem);
  color: var(--secondary);
  letter-spacing: 0.2em;
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify hero layout in browser**

Temporarily add `display: none` to the `.loader` rule (or comment out the loader div) to see the hero.

Expected:
- Full-viewport hero image — woman in the golden field, no bars or letterboxing.
- Black LGNDRY.Co logo visible at top-center over the bright sky area.
- "Found Beauty in the Mundane." in white Cormorant Garamond at the lower third, centered.
- Logo and tagline readable with natural contrast — no overlay needed.
- No zoom animation (JS hasn't been wired yet — verify the image is static here).

Undo the temporary change to the loader before committing.

- [ ] **Step 4: Commit**

```bash
git add index.html assests/css/style.css
git commit -m "feat: hero section — full-viewport image, logo, tagline"
```

---

### Task 4: JS Sequencer

**Files:**
- Create: `assests/js/main.js`

**Interfaces:**
- Consumes:
  - `document.getElementById('loader')` → `.loader` element
  - `document.querySelector('.hero__image')` → `<img>` element
  - CSS classes: `.loader--exit`, `.loader--hidden`, `.hero__image--zoom`
  - `sessionStorage` key: `'lgndry_loaded'`
- Produces: Full loading experience end-to-end. No exports — self-contained IIFE.

- [ ] **Step 1: Create `assests/js/main.js`**

```javascript
(function () {
  var STORAGE_KEY = 'lgndry_loaded';
  var loader      = document.getElementById('loader');
  var heroImage   = document.querySelector('.hero__image');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hideLoader() {
    loader.classList.add('loader--hidden');
  }

  function startHeroZoom() {
    if (heroImage && !prefersReducedMotion) {
      heroImage.classList.add('hero__image--zoom');
    }
  }

  function skipLoader() {
    // Returning visitor in same session — skip instantly
    hideLoader();
    setTimeout(startHeroZoom, 300);
  }

  function runLoader() {
    if (prefersReducedMotion) {
      // Respect system preference — skip animation entirely
      hideLoader();
      sessionStorage.setItem(STORAGE_KEY, '1');
      return;
    }

    // Wait for wordmark animation to complete + hold (2200ms total)
    // then lift curtain and start hero zoom simultaneously
    setTimeout(function () {
      startHeroZoom();
      loader.classList.add('loader--exit');

      // Remove loader from paint tree after curtain transition ends
      loader.addEventListener('transitionend', function onEnd() {
        loader.removeEventListener('transitionend', onEnd);
        hideLoader();
        sessionStorage.setItem(STORAGE_KEY, '1');
      });
    }, 2200);
  }

  if (sessionStorage.getItem(STORAGE_KEY)) {
    skipLoader();
  } else {
    runLoader();
  }
}());
```

- [ ] **Step 2: Verify first-load sequence in browser**

Open `index.html` in a fresh tab (or clear sessionStorage via DevTools → Application → Session Storage → Clear).

Expected sequence:
1. White screen — wordmark letters appear compressed/stacked.
2. ~0.5s — letters spread apart to full tracking.
3. ~1.4s — wordmark settles. Brief silence.
4. ~2.2s — loader slides upward like a curtain; hero image revealed beneath it. Very subtle zoom already in progress.
5. ~3.1s — loader fully gone, hero fills viewport, image zooming imperceptibly slowly toward `scale(1.06)`.
6. ~13s — zoom reaches final scale and stops. Never loops.

Open DevTools → Application → Session Storage. Confirm `lgndry_loaded = "1"` is set after curtain completes.

- [ ] **Step 3: Verify returning-visitor behaviour**

Without closing the tab (session still active), navigate away and back, or refresh.

Expected:
- Loader is invisible instantly — no flash, no animation.
- Hero image visible immediately.
- Subtle zoom starts after ~300ms.
- No layout shift.

- [ ] **Step 4: Commit**

```bash
git add assests/js/main.js
git commit -m "feat: JS sequencer — sessionStorage flag, curtain lift, hero zoom trigger"
```

---

### Task 5: Responsive Layout + Accessibility

**Files:**
- Modify: `assests/css/style.css` (append responsive and reduced-motion rules)

**Interfaces:**
- Consumes: All CSS classes from Tasks 2 and 3.
- Produces: No new classes — extends existing rules with breakpoint overrides and motion query.

- [ ] **Step 1: Append responsive and reduced-motion rules to `assests/css/style.css`**

```css
/* ─── Responsive ─────────────────────────────────── */
@media (max-width: 1023px) {
  .hero__logo {
    width: 120px;
  }
}

@media (max-width: 639px) {
  .hero__image {
    object-position: 55% center; /* nudge right to keep subject visible on narrow viewport */
  }

  .hero__logo {
    width: 100px;
    margin-top: 60px;
  }

  .hero__tagline {
    top: 78%;
    font-size: 0.85rem;
    letter-spacing: 0.12em;
    white-space: normal;
    text-align: center;
    width: 80%;
    left: 10%;
    transform: none;
  }
}

/* ─── Reduced Motion ─────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .loader__wordmark {
    animation: none;
    opacity: 1;
    letter-spacing: 0.25em;
  }

  .loader--exit {
    transition: none;
  }

  .hero__image--zoom {
    animation: none;
  }
}
```

- [ ] **Step 2: Verify responsive layout**

Open `index.html`. Open DevTools → toggle device toolbar.

**Mobile (375px wide):**
- Logo is 100px wide, sits ~60px from top.
- Hero image shifts slightly right — subject (woman) remains centered and not clipped.
- Tagline is at ~78% height, slightly smaller, remains readable.
- Wordmark in loader fits without overflow — `clamp(2rem, 6vw, 4rem)` handles this automatically.

**Tablet (768px wide):**
- Logo is 120px wide.
- Tagline and image position unchanged from desktop.

**Desktop (1440px wide):**
- Logo 140px, tagline at 72% — all as designed.

- [ ] **Step 3: Verify reduced-motion behaviour**

In Chrome DevTools → Rendering panel → Enable "Emulate CSS media feature prefers-reduced-motion: reduce".

Reload page.

Expected:
- Loader is hidden instantly (JS `prefersReducedMotion` path fires).
- Hero image is immediately visible, static — no zoom.
- No CSS animations play.

Turn off emulation. Reload. Confirm normal animation sequence resumes.

- [ ] **Step 4: Final end-to-end check**

Clear sessionStorage. Reload at desktop size. Watch the full sequence once more.

Confirm:
- Wordmark stacks → spreads → holds → curtain lifts → hero breathes in slowly.
- No flicker, no layout shift, no console errors.
- Logo readable over sky. Tagline readable over dark grass. No overlay.

- [ ] **Step 5: Commit and push**

```bash
git add assests/css/style.css
git commit -m "feat: responsive breakpoints and prefers-reduced-motion accessibility"
git push origin main
```
