# Homepage Body Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the homepage body — editorial intro, philosophy statement, three scattered photo "moments," companies worked with, services, and a closing statement — entirely from existing photography, no new image assets.

**Architecture:** All new markup appends to `index.html` after the existing `.nav-panel` and before the closing `<script>` tag. All new CSS appends to `assests/css/style.css`. A single new IIFE appends to `assests/js/main.js` implementing a shared `IntersectionObserver`-based scroll-reveal system that every new section opts into via a `.reveal` class.

**Tech Stack:** Pure HTML / CSS / ES5 JavaScript — no libraries, no build tools.

## Global Constraints

- ES5 only — `var`, no `const`/`let`, no arrow functions, no template literals, no destructuring
- No hardcoded hex values in CSS except inside `:root` — all colours via `var(--*)`
- Assets folder is spelled `assests/` — never correct it
- Only images from `assests/images/art/outdoor/` top level (never the `border/` subfolder — those have baked-in text captions) and `assests/images/client logos/` may be used — no other folders, no new files
- Append all CSS to the end of `assests/css/style.css` — do not modify any existing rule
- Append all JS to the end of `assests/js/main.js` as a new IIFE — do not modify any existing IIFE
- All animations use `opacity` and `transform` only — no `width`, `height`, `top`, `left` animations
- Every top-level new section gets `margin: 120px 0` (`80px` tablet, `64px` mobile) — see Task 2
- `prefers-reduced-motion: reduce` — reveal happens instantly, no transition, no observer delay

---

### Task 1: HTML Markup — All Sections

**Files:**
- Modify: `index.html:90-91` (insert between the `.nav-panel` closing `</div>` and the `<script>` tag)

**Interfaces:**
- Produces:
  - `.intro`, `.intro__text.reveal`, `.intro__image.reveal`
  - `.moment.moment--motion.reveal`, `.moment.moment--stillness.reveal`, `.moment.moment--texture.reveal` (each containing `.moment__image` + `.moment__caption`)
  - `.philosophy`, `.philosophy__text.reveal`, `.philosophy__image.reveal`
  - `.companies.reveal`, `.companies__label`, `.companies__list`, `.companies__logo.companies__logo--vw`, `.companies__logo.companies__logo--kitso`, `.companies__logo.companies__logo--capricorn`
  - `.services`, `.services__label`, `.services__list`, `.services__item.reveal` (×6)
  - `.closing.reveal`, `.closing__image`, `.closing__text`
  - All of the above are consumed by Task 2 (CSS foundation), Task 3 (CSS remainder), and Task 4 (JS reveal, which queries `.reveal`)

- [ ] **Step 1: Insert all section markup**

In `index.html`, insert the following block between the `.nav-panel` closing `</div>` (currently line 90) and `<script src="assests/js/main.js"></script>` (currently line 92):

```html
  <!-- Editorial Intro -->
  <section class="intro">
    <h2 class="intro__text reveal">LGNDRY.Co captures the beauty hidden inside ordinary moments.</h2>
    <img class="intro__image reveal" src="assests/images/art/outdoor/InShot_20240602_184217752.jpg" alt="">
  </section>

  <!-- Moment: Motion -->
  <section class="moment moment--motion reveal">
    <img class="moment__image" src="assests/images/art/outdoor/InShot_20241224_173743706.jpg" alt="">
    <h3 class="moment__caption">Motion.</h3>
  </section>

  <!-- Philosophy -->
  <section class="philosophy">
    <h2 class="philosophy__text reveal">
      We document people, places, textures, stillness, motion —<br>
      finding beauty where most people simply pass by.
    </h2>
    <img class="philosophy__image reveal" src="assests/images/art/outdoor/InShot_20250606_193143254.jpg" alt="">
  </section>

  <!-- Moment: Stillness -->
  <section class="moment moment--stillness reveal">
    <img class="moment__image" src="assests/images/art/outdoor/InShot_20260211_201611759.jpg" alt="">
    <h3 class="moment__caption">Stillness.</h3>
  </section>

  <!-- Moment: Texture -->
  <section class="moment moment--texture reveal">
    <h3 class="moment__caption">Texture.</h3>
    <img class="moment__image" src="assests/images/art/outdoor/InShot_20240821_203154916.jpg" alt="">
  </section>

  <!-- Companies Worked With -->
  <section class="companies reveal">
    <h2 class="companies__label">Selected Collaborations.</h2>
    <div class="companies__list">
      <img class="companies__logo companies__logo--vw" src="assests/images/client logos/vw.png" alt="Volkswagen">
      <img class="companies__logo companies__logo--kitso" src="assests/images/client logos/kitso-logo.png" alt="Kitsotlhale Trading">
      <img class="companies__logo companies__logo--capricorn" src="assests/images/client logos/capricorn-fm.b6efb469.jpg" alt="Capricorn FM">
    </div>
  </section>

  <!-- Services -->
  <section class="services">
    <h2 class="services__label">Services.</h2>
    <div class="services__list">
      <p class="services__item reveal">Photography</p>
      <p class="services__item reveal">Visual Direction</p>
      <p class="services__item reveal">Brand Campaigns</p>
      <p class="services__item reveal">Event Coverage</p>
      <p class="services__item reveal">Product &amp; Lifestyle Shoots</p>
      <p class="services__item reveal">Creative Storytelling</p>
    </div>
  </section>

  <!-- Closing Statement -->
  <section class="closing reveal">
    <img class="closing__image" src="assests/images/art/outdoor/InShot_20260118_233430615.jpg" alt="">
    <h2 class="closing__text">Not everything beautiful asks for attention. Some things simply wait to be noticed.</h2>
  </section>
```

- [ ] **Step 2: Verify markup**

Open `index.html` in a browser (unstyled — that's expected, CSS comes in Tasks 2–3). In DevTools → Elements, confirm:
- 8 new `<section>`-level blocks exist between `#navPanel` and `<script>`: `.intro`, `.moment.moment--motion`, `.philosophy`, `.moment.moment--stillness`, `.moment.moment--texture`, `.companies`, `.services`, `.closing`
- `.companies__list` has exactly 3 `<img>` children with `alt="Volkswagen"`, `alt="Kitsotlhale Trading"`, `alt="Capricorn FM"`
- `.services__list` has exactly 6 `<p class="services__item reveal">` children
- Every image `src` resolves (no broken-image icon) — open DevTools → Network → Img and reload to confirm all 6 photography files and all 3 logo files return 200

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: homepage body — markup for intro, moments, philosophy, companies, services, closing"
```

---

### Task 2: CSS — Reveal System + Intro + Philosophy

**Files:**
- Modify: `assests/css/style.css` (append to end)

**Interfaces:**
- Consumes: `.intro`, `.intro__text`, `.intro__image`, `.philosophy`, `.philosophy__text`, `.philosophy__image`, `.reveal` from Task 1
- Produces:
  - `.reveal` / `.reveal--visible` — the shared scroll-reveal pair every section uses (consumed by Task 4 JS and by Task 3's remaining sections)
  - Section vertical-rhythm rule (`margin: 120px 0` on all 6 top-level section selectors) — Task 3 adds its own selectors to this same rule when it appends responsive overrides
  - Desktop layout for `.intro` and `.philosophy`

- [ ] **Step 1: Append the shared reveal system and vertical rhythm rule**

```css
/* ─── Scroll Reveal (shared by all homepage-body sections) ─── */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.9s ease-out, transform 0.9s ease-out;
}

.reveal--visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    transition: none;
  }
}

/* ─── Homepage Section Vertical Rhythm ───────────── */
.intro,
.moment,
.philosophy,
.companies,
.services,
.closing {
  margin: 120px 0;
}
```

- [ ] **Step 2: Append Editorial Intro styles**

```css
/* ─── Editorial Intro ────────────────────────────── */
.intro {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
}

.intro__text {
  margin-left: 8vw;
  max-width: 14ch;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: clamp(2rem, 4.5vw, 3.5rem);
  line-height: 1.3;
  color: var(--text-primary);
}

.intro__image {
  position: absolute;
  right: -10vw;
  top: 10%;
  width: 55vw;
  height: 70vh;
  object-fit: cover;
}
```

Note: vertical centering for `.intro__text` is done via the parent's `display: flex; align-items: center` rather than `transform: translateY(-50%)` — the element already carries `.reveal`'s own `transform: translateY(24px)`, and a second `transform` declaration would silently overwrite it.

- [ ] **Step 3: Append Philosophy styles**

```css
/* ─── Philosophy ─────────────────────────────────── */
.philosophy {
  position: relative;
  min-height: 70vh;
}

.philosophy__text {
  position: absolute;
  left: 8vw;
  top: 15%;
  max-width: 32ch;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  line-height: 1.5;
  color: var(--text-primary);
}

.philosophy__image {
  position: absolute;
  right: -5vw;
  bottom: 10%;
  width: 28vw;
  height: auto;
  object-fit: cover;
}
```

- [ ] **Step 4: Verify reveal + layout**

Open `index.html`. In DevTools console, run:
```js
document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('reveal--visible'); });
```
Confirm: all intro/philosophy text and images fade to full opacity and settle to `translateY(0)` over ~0.9s.

Then in DevTools → Elements, select `.intro`:
- Confirm computed `display: flex`, `align-items: center` — the intro line sits vertically centered
- `.intro__image` sits absolutely positioned, bleeding past the right edge of the viewport (visible via the horizontal scrollbar NOT appearing — `body { overflow-x: hidden }` already exists and clips it)

Select `.philosophy__text` and `.philosophy__image` — confirm both are `position: absolute` with the offsets above, image sits in the opposite corner from the text and is partially cropped by the viewport's right edge.

- [ ] **Step 5: Commit**

```bash
git add assests/css/style.css
git commit -m "feat: homepage body CSS — reveal system, intro, philosophy"
```

---

### Task 3: CSS — Moments, Companies, Services, Closing, Responsive, Reduced Motion

**Files:**
- Modify: `assests/css/style.css` (append to end)

**Interfaces:**
- Consumes: all markup from Task 1; `.reveal`/`.reveal--visible` and the section vertical-rhythm rule from Task 2
- Produces: complete desktop, tablet, and mobile styling for `.moment` (all 3 variants), `.companies`, `.services`, `.closing`

- [ ] **Step 1: Append Moment styles (Motion, Stillness, Texture)**

```css
/* ─── Moments (scattered photo + caption pairs) ──── */
.moment {
  position: relative;
  min-height: 60vh;
  display: flex;
  align-items: center;
}

.moment__image {
  display: block;
  object-fit: cover;
}

.moment__caption {
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-style: italic;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.moment--motion .moment__image {
  width: 38vw;
  height: 50vh;
  margin-left: 6vw;
}

.moment--motion .moment__caption {
  margin-left: 32px;
}

.moment--stillness {
  justify-content: flex-end;
}

.moment--stillness .moment__image {
  width: 34vw;
  height: 65vh;
  margin-right: 6vw;
  order: 2;
}

.moment--stillness .moment__caption {
  order: 1;
  margin-right: 32px;
}

.moment--texture {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  margin-left: 18vw;
}

.moment--texture .moment__image {
  width: 30vw;
  height: 40vh;
}

.moment--texture .moment__caption {
  font-size: 1.25rem;
  margin-bottom: 16px;
}
```

- [ ] **Step 2: Append Companies Worked With styles**

```css
/* ─── Companies Worked With ──────────────────────── */
.companies__label {
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: 1.75rem;
  color: var(--text-primary);
  margin-bottom: 80px;
}

.companies__list {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
}

.companies__logo {
  max-width: 140px;
  filter: grayscale(1);
  opacity: 0.75;
  transition: filter 0.4s ease, opacity 0.4s ease;
}

.companies__logo:hover {
  filter: grayscale(0);
  opacity: 1;
}

.companies__logo--kitso {
  margin-top: -24px;
}

.companies__logo--capricorn {
  margin-top: 16px;
}
```

- [ ] **Step 3: Append Services styles**

```css
/* ─── Services ───────────────────────────────────── */
.services__label {
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: 1.75rem;
  color: var(--text-primary);
  margin-bottom: 40px;
}

.services__list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.services__item {
  position: relative;
  display: inline-block;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: clamp(1.75rem, 3.5vw, 2.5rem);
  color: var(--text-primary);
  padding: 32px 0;
}

.services__item::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 24px;
  width: 0;
  height: 1px;
  background-color: var(--text-primary);
  transition: width 0.4s ease;
}

.services__item:hover::after {
  width: 100%;
}

.services__list > .services__item:nth-child(even) {
  margin-left: 20vw;
}
```

- [ ] **Step 4: Append Closing Statement styles**

```css
/* ─── Closing Statement ──────────────────────────── */
.closing {
  position: relative;
}

.closing__image {
  display: block;
  width: 100%;
  height: 80vh;
  object-fit: cover;
}

.closing__text {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 64px 24px 48px;
  text-align: center;
  color: #FFFFFF;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-size: clamp(1.75rem, 4vw, 3rem);
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.35));
}
```

- [ ] **Step 5: Append tablet responsive overrides**

```css
/* ─── Homepage Body Responsive: Tablet ───────────── */
@media (min-width: 768px) and (max-width: 1023px) {
  .intro,
  .moment,
  .philosophy,
  .companies,
  .services,
  .closing {
    margin: 80px 0;
  }

  .intro__image,
  .philosophy__image,
  .moment--motion .moment__image,
  .moment--stillness .moment__image,
  .moment--texture .moment__image {
    width: 70vw;
    height: auto;
  }

  .services__list > .services__item:nth-child(even) {
    margin-left: 8vw;
  }
}
```

- [ ] **Step 6: Append mobile responsive overrides**

```css
/* ─── Homepage Body Responsive: Mobile ───────────── */
@media (max-width: 767px) {
  .intro,
  .moment,
  .philosophy,
  .companies,
  .services,
  .closing {
    margin: 64px 0;
  }

  .intro {
    display: block;
    min-height: auto;
  }

  .intro__text {
    margin: 0 0 32px;
    max-width: none;
  }

  .intro__image {
    position: static;
    width: 100%;
    height: 50vh;
  }

  .philosophy {
    min-height: auto;
  }

  .philosophy__text {
    position: static;
    max-width: none;
    margin-bottom: 32px;
  }

  .philosophy__image {
    position: static;
    width: 100%;
    height: 50vh;
  }

  .moment,
  .moment--motion,
  .moment--stillness,
  .moment--texture {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-left: 0;
    text-align: center;
  }

  .moment--motion .moment__image,
  .moment--stillness .moment__image,
  .moment--texture .moment__image {
    width: 100%;
    height: 40vh;
    margin: 0 0 24px;
    order: 0;
  }

  .moment--motion .moment__caption,
  .moment--stillness .moment__caption {
    margin: 0;
    order: 0;
  }

  .companies__list {
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 32px;
  }

  .companies__logo--kitso,
  .companies__logo--capricorn {
    margin-top: 0;
  }

  .services__list > .services__item:nth-child(even) {
    margin-left: 0;
  }

  .closing__image {
    height: 50vh;
  }
}
```

- [ ] **Step 7: Verify desktop layout**

Open `index.html`, reveal everything via DevTools console (`document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('reveal--visible');})`), then scroll through the page:
- Motion moment: image sits left with a `Motion.` caption to its right, vertically centered against the image
- Stillness moment: image sits right with `Stillness.` caption to its left (mirrored from Motion)
- Texture moment: `Texture.` caption sits above a smaller, left-of-center image
- Companies: 3 logos, `kitso-logo.png` higher than baseline, `capricorn-fm.b6efb469.jpg` lower — grayscale at rest, hovering one restores full color
- Services: 6 items stacked, even-numbered items (2nd, 4th, 6th) indented `20vw`; hovering any item draws an underline in from the left over ~0.4s
- Closing: image fills `80vh`, closing line sits on a dark scrim in the lower third, white text is legible

- [ ] **Step 8: Verify responsive breakpoints**

In DevTools responsive mode:
- At 900px width (tablet): all moment/intro/philosophy images are `70vw`, services even-item indent is `8vw`, section margins visibly tighter than desktop
- At 375px width (mobile): intro and philosophy stack image-below-text full width; all 3 moments stack image-above-caption, centered; companies logos stack vertically with uniform spacing (no more high/low offset); all services items are left-aligned (no indent;) closing image is `50vh`

- [ ] **Step 9: Commit**

```bash
git add assests/css/style.css
git commit -m "feat: homepage body CSS — moments, companies, services, closing, responsive"
```

---

### Task 4: JS — Scroll Reveal

**Files:**
- Modify: `assests/js/main.js` (append new IIFE at end of file)

**Interfaces:**
- Consumes: `.reveal` elements from Task 1; `.reveal--visible` CSS class from Task 2
- Produces: automatic scroll-triggered reveal for every `.reveal` element on the page (including the ones added by Tasks 2–3's markup)

- [ ] **Step 1: Append the scroll reveal IIFE to `main.js`**

Add this block after the closing `}());` of the existing hover-photography IIFE (end of file):

```js
/* ─── Homepage Body: Scroll Reveal ───────────────── */
(function () {
  var revealEls = document.querySelectorAll('.reveal');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var i;

  if (prefersReducedMotion) {
    for (i = 0; i < revealEls.length; i++) {
      revealEls[i].classList.add('reveal--visible');
    }
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].isIntersecting) {
        entries[j].target.classList.add('reveal--visible');
        observer.unobserve(entries[j].target);
      }
    }
  }, { threshold: 0.2 });

  for (i = 0; i < revealEls.length; i++) {
    observer.observe(revealEls[i]);
  }
}());
```

- [ ] **Step 2: Verify scroll reveal behaviour**

Open `index.html` in a browser (not DevTools-emulated reduced motion). Scroll down slowly from the top:
1. Each section's `.reveal` elements should be invisible (`opacity: 0`, shifted down 24px) until roughly 20% of the element has entered the viewport
2. As each element crosses that threshold, it fades in and settles over ~0.9s
3. Scroll back up past a section that already revealed, then scroll back down — it should remain visible (not re-hide, not re-animate) since `unobserve` was called
4. In DevTools → Elements, confirm revealed elements have `class="... reveal reveal--visible"` (both classes present)

- [ ] **Step 3: Verify reduced-motion behaviour**

In DevTools → Rendering tab, enable "Emulate CSS media feature prefers-reduced-motion: reduce". Reload the page. Confirm:
- Every `.reveal` element has `reveal--visible` immediately on load (visible in Elements panel without scrolling)
- No transition/animation plays — content is simply present at full opacity from the start

- [ ] **Step 4: Commit**

```bash
git add assests/js/main.js
git commit -m "feat: homepage body JS — IntersectionObserver scroll reveal"
```

---

## Self-Review Notes

**Spec coverage verified:**
- ✅ Design philosophy: asymmetric, scattered images, no clustering, no cards/borders/icon grids (§1) — reflected in Moment sections spread across Tasks 1–3 rather than one gallery block
- ✅ Architecture: append-only to 3 existing files, no new files/images (§2) — Task 1 markup insertion point, Tasks 2–3 CSS append, Task 4 JS append
- ✅ Images: all 6 from `art/outdoor/` top level only, no `border/` subfolder (§2) — verified each file exists at that exact path during brainstorming
- ✅ Logos: all 3 from `client logos/`, grayscale at rest, full color on hover (§5.6, confirmed via user Q&A) — Task 3 Step 2
- ✅ Vertical rhythm: `120px`/`80px`/`64px` margins (§3) — Task 2 Step 1 (base), Task 3 Steps 5–6 (tablet/mobile overrides)
- ✅ Color/typography: only existing `:root` vars and existing fonts (§4) — no new variables introduced anywhere in this plan
- ✅ Intro (§5.1): copy, image bleed, `clamp` type scale — Task 2 Step 2
- ✅ Moment: Motion (§5.2), single-word italic caption — Task 3 Step 1
- ✅ Philosophy (§5.3): two-line offset copy, cropped image — Task 2 Step 3
- ✅ Moment: Stillness (§5.4), mirrored alignment — Task 3 Step 1
- ✅ Moment: Texture (§5.5), off-rhythm placement — Task 3 Step 1
- ✅ Companies (§5.6): staggered vertical offsets, grayscale/hover — Task 3 Step 2
- ✅ Services (§5.7): staggered indentation, underline hover, no links — Task 3 Step 3
- ✅ Closing (§5.8): full-width image, scrim, centered copy — Task 3 Step 4
- ✅ Motion & scroll reveal (§6): `IntersectionObserver`, threshold 0.2, unobserve-once, reduced-motion instant — Task 2 Step 1 (CSS) + Task 4 (JS)
- ✅ Responsive (§7): tablet 70vw images / 8vw indent / 80px margins; mobile static stacking / 0 indent / 64px margins / 50vh closing — Task 3 Steps 5–6
- ✅ Accessibility (§8): `alt=""` on decorative photos, descriptive `alt` on logos, `.reveal` elements present in DOM (not `display:none`), heading hierarchy (`h2`/`h3` as specified) — Task 1 markup

**Design conflict resolved during planning:** the spec describes `.intro__text` as vertically centered via `top: 50%` positioning, which would normally use `transform: translateY(-50%)`. Since `.intro__text` also carries `.reveal` (which uses `transform: translateY(24px)` → `translateY(0)`), a second `transform` declaration on the same element would silently overwrite the reveal offset. Resolved by centering `.intro__text` with flexbox (`.intro { display: flex; align-items: center; }`) instead of transform-based centering, leaving `transform` exclusively owned by `.reveal`. No other section has this conflict — all other absolute-positioned elements use `top`/`right`/`bottom`/`left` offsets, not transform-based centering.

**Type/class consistency:** verified `.moment__image`, `.moment__caption`, `.companies__logo--vw/kitso/capricorn`, `.services__item`, `.closing__text` etc. are spelled identically between Task 1 (markup) and Tasks 2–3 (CSS) — no mismatches.
