(function () {
  var STORAGE_KEY = 'lgndry_loaded';
  var loader      = document.getElementById('loader');
  var heroImage   = document.querySelector('.hero__image');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Interior pages (e.g. services) have no loader/hero — skip this block there.
  if (!loader) { return; }

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

/* ─── Navigation: open / close ───────────────────── */
(function () {
  var trigger  = document.getElementById('navTrigger');
  var panel    = document.getElementById('navPanel');
  var closeBtn = document.getElementById('navClose');
  var items    = document.querySelectorAll('.nav-panel__item');
  var isOpen   = false;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function openNav() {
    if (isOpen) return;
    isOpen = true;

    panel.classList.add('nav-panel--open');
    panel.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.style.opacity = '0';
    trigger.style.pointerEvents = 'none';
    closeBtn.focus();

    var staggerDelay = prefersReducedMotion ? 0 : 500;
    var staggerStep  = prefersReducedMotion ? 0 : 80;

    for (var i = 0; i < items.length; i++) {
      (function (item, delay) {
        setTimeout(function () {
          item.classList.add('nav-panel__item--visible');
        }, delay);
      })(items[i], staggerDelay + i * staggerStep);
    }
  }

  function closeNav() {
    if (!isOpen) return;

    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('nav-panel__item--visible');
    }

    var closeDelay = prefersReducedMotion ? 0 : 100;

    setTimeout(function () {
      panel.classList.remove('nav-panel--open');
      panel.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.style.opacity = '';
      trigger.style.pointerEvents = '';
      isOpen = false;
      trigger.focus();
    }, closeDelay);
  }

  trigger.addEventListener('click', openNav);
  closeBtn.addEventListener('click', closeNav);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) { closeNav(); }
  });

  document.addEventListener('click', function (e) {
    if (isOpen && !panel.contains(e.target) && e.target !== trigger) {
      closeNav();
    }
  });

  window.lgndryNav = { open: openNav, close: closeNav };
}());

/* ─── Navigation: hover photography ─────────────── */
(function () {
  var list        = document.querySelector('.nav-panel__list');
  var items       = document.querySelectorAll('.nav-panel__item');
  var photos      = document.querySelectorAll('.nav-panel__photo');
  var linksColumn = document.querySelector('.nav-panel__links');

  function isMobile() {
    return window.matchMedia('(max-width: 639px)').matches;
  }

  function setActivePhoto(key) {
    for (var i = 0; i < photos.length; i++) {
      photos[i].classList.remove('nav-panel__photo--active');
    }
    var target = document.querySelector('[data-nav-photo="' + key + '"]');
    if (!target) return;
    target.classList.add('nav-panel__photo--active');

    if (isMobile()) {
      linksColumn.style.backgroundImage = 'url("' + target.getAttribute('src') + '")';
    }
  }

  function clearHoverState() {
    list.classList.remove('nav-panel__list--hovering');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('nav-panel__item--hovered');
    }
    setActivePhoto('home');
    if (isMobile()) {
      linksColumn.style.backgroundImage = '';
    }
  }

  for (var i = 0; i < items.length; i++) {
    (function (item) {
      item.addEventListener('mouseenter', function () {
        list.classList.add('nav-panel__list--hovering');
        for (var j = 0; j < items.length; j++) {
          items[j].classList.remove('nav-panel__item--hovered');
        }
        item.classList.add('nav-panel__item--hovered');
        setActivePhoto(item.getAttribute('data-nav-image'));
      });
    })(items[i]);
  }

  list.addEventListener('mouseleave', clearHoverState);
}());

/* Homepage Body: Philosophy scroll gallery */
(function () {
  var galleries = document.querySelectorAll('[data-scroll-gallery]');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ticking = false;
  var galleryData = [];

  if (!galleries.length || prefersReducedMotion) return;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function smooth(value) {
    return value * value * (3 - (2 * value));
  }

  function setCopyActive(copies, activeIndex) {
    for (var i = 0; i < copies.length; i++) {
      if (i === activeIndex) {
        copies[i].classList.add('philosophy-gallery__copy--active');
      } else {
        copies[i].classList.remove('philosophy-gallery__copy--active');
      }
    }
  }

  for (var i = 0; i < galleries.length; i++) {
    galleryData.push({
      section: galleries[i],
      images: galleries[i].querySelectorAll('[data-scroll-gallery-image]'),
      copies: galleries[i].querySelectorAll('[data-scroll-gallery-copy]'),
      progress: galleries[i].querySelector('[data-scroll-gallery-progress]')
    });
  }

  // Fraction of each image's scroll "unit" spent holding on the image
  // before it begins dissolving into the next. The remainder is the
  // cross-dissolve. Higher = each photo lingers longer, like an exhibition.
  var HOLD = 0.6;

  function updateGallery() {
    ticking = false;

    for (var g = 0; g < galleryData.length; g++) {
      var data = galleryData[g];
      var rect = data.section.getBoundingClientRect();
      var scrollLength = Math.max(data.section.offsetHeight - window.innerHeight, 1);
      var progress = clamp(-rect.top / scrollLength, 0, 1);
      var maxIndex = Math.max(data.images.length - 1, 1);

      // Position along the image sequence, 0 .. maxIndex.
      var exact = progress * maxIndex;
      var current = Math.floor(exact);
      if (current >= maxIndex) { current = maxIndex - 1; }
      var frac = exact - current;                // 0..1 within current -> next
      var next = current + 1;

      // Hold on the current image, then ease the dissolve to the next.
      var raw = frac <= HOLD ? 0 : (frac - HOLD) / (1 - HOLD);
      var blend = smooth(clamp(raw, 0, 1));      // 0 = current, 1 = next

      for (var j = 0; j < data.images.length; j++) {
        var opacity;
        var scale;
        var drift;

        if (j === current) {
          // Held image: fully opaque underneath, slow Ken Burns zoom.
          opacity = 1;
          scale = 1 + (frac * 0.045);
          drift = 0;
        } else if (j === next) {
          // Incoming image: fades in on top and settles from a touch larger.
          opacity = blend;
          scale = 1.06 - (blend * 0.06);
          drift = (1 - blend) * 14;
        } else {
          opacity = 0;
          scale = 1.04;
          drift = 0;
        }

        data.images[j].style.opacity = opacity.toFixed(3);
        data.images[j].style.transform = 'scale(' + scale.toFixed(4) + ') translate3d(0, ' + drift.toFixed(2) + 'px, 0)';
      }

      var primary = blend < 0.5 ? current : next;
      for (var k = 0; k < data.images.length; k++) {
        if (k === primary) {
          data.images[k].classList.add('philosophy-gallery__image--active');
        } else {
          data.images[k].classList.remove('philosophy-gallery__image--active');
        }
      }

      // Advance the copy as soon as the dissolve begins, so the new words
      // arrive with the new photograph.
      setCopyActive(data.copies, frac <= HOLD ? current : next);

      if (data.progress) {
        data.progress.style.width = (progress * 100).toFixed(2) + '%';
      }
    }
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateGallery);
  }

  updateGallery();
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
}());
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

/* ─── Intro band: Ken Burns image slideshow ──────── */
(function () {
  var figure = document.querySelector('[data-intro-slideshow]');
  if (!figure) { return; }

  var slides = figure.querySelectorAll('.intro-band__slide');
  if (slides.length < 2) { return; }

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // First slide is always shown (also the static state for reduced motion).
  slides[0].classList.add('is-visible');
  slides[0].style.zIndex = 2;

  if (prefersReducedMotion) { return; }

  slides[0].classList.add('is-zooming');

  var index = 0;
  var HOLD = 5000;      // display time per image — matches the 5s zoom
  var FADE = 1400;      // cross-dissolve duration — matches CSS opacity transition

  function advance() {
    var current = slides[index];
    var nextIndex = (index + 1) % slides.length;
    var next = slides[nextIndex];

    // Restart the zoom on the incoming slide from the beginning.
    next.classList.remove('is-zooming');
    void next.offsetWidth; // force reflow so the animation replays

    // Incoming fades in on top; keep the outgoing beneath it during the fade.
    next.style.zIndex = 3;
    current.style.zIndex = 2;
    next.classList.add('is-visible', 'is-zooming');

    // Once the incoming image fully covers the old one, hide the old one and
    // drop it to the back, ready for its next turn.
    setTimeout(function () {
      current.classList.remove('is-visible', 'is-zooming');
      current.style.zIndex = 1;
    }, FADE);

    index = nextIndex;
  }

  setInterval(advance, HOLD);
}());

/* ─── Collection: category filters ───────────────── */
(function () {
  var bar = document.querySelector('[data-collection-filters]');
  if (!bar) { return; }

  var buttons = bar.querySelectorAll('[data-filter]');
  var cards = document.querySelectorAll('.work[data-category]');

  for (var i = 0; i < buttons.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        for (var j = 0; j < buttons.length; j++) {
          buttons[j].classList.remove('collection-filter--active');
        }
        btn.classList.add('collection-filter--active');

        var filter = btn.getAttribute('data-filter');
        for (var k = 0; k < cards.length; k++) {
          var show = filter === 'all' || cards[k].getAttribute('data-category') === filter;
          cards[k].style.display = show ? '' : 'none';
        }
      });
    })(buttons[i]);
  }
}());

/* Booking modal */
(function () {
  var bookingTriggers = document.querySelectorAll('a, button');
  var modal;
  var lastFocused;

  function isBookingTrigger(el) {
    if (!el) return false;
    if (el.hasAttribute('data-booking-modal')) return true;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var href = (el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    return text === 'book a session' || href.indexOf('booking%20a%20session') !== -1;
  }

  function createModal() {
    var wrapper = document.createElement('div');
    wrapper.className = 'booking-modal';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = '' +
      '<div class="booking-modal__backdrop" data-booking-close></div>' +
      '<section class="booking-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="bookingModalTitle" tabindex="-1">' +
        '<button class="booking-modal__close" type="button" aria-label="Close booking form" data-booking-close>' +
          '<span></span><span></span>' +
        '</button>' +
        '<aside class="booking-modal__visual" aria-hidden="true">' +
          '<div class="booking-modal__brand">' +
            '<strong>LGNDRY.CO</strong>' +
            '<span>Visual Storytelling</span>' +
          '</div>' +
          '<div class="booking-modal__visual-copy">' +
            '<p>Let\'s create<br>something<br>worth<br>remembering.</p>' +
            '<span></span>' +
            '<small>Step 1 of 4</small>' +
          '</div>' +
        '</aside>' +
        '<div class="booking-modal__panel">' +
          '<div class="booking-modal__intro">' +
            '<p class="booking-modal__eyebrow">Book a Session</p>' +
            '<h2 id="bookingModalTitle">Let\'s plan your session.</h2>' +
            '<p>Fill in the details below and we\'ll get back to you within 24 hours.</p>' +
            '<span class="booking-modal__rule" aria-hidden="true"></span>' +
          '</div>' +
          '<div class="booking-modal__content">' +
            '<ol class="booking-modal__steps" aria-label="Booking steps">' +
              '<li class="is-active"><span>1</span><strong>Session Type</strong></li>' +
              '<li><span>2</span><strong>Date & Time</strong></li>' +
              '<li><span>3</span><strong>Your Details</strong></li>' +
              '<li><span>4</span><strong>Review & Confirm</strong></li>' +
            '</ol>' +
            '<form class="booking-modal__form" action="mailto:info@lgndry-co.co.za" method="post" enctype="text/plain">' +
              '<label class="booking-modal__field booking-modal__field--wide">' +
                '<span>What type of session are you booking?</span>' +
                '<select name="session_type" required>' +
                  '<option value="">Select session type</option>' +
                  '<option>Portrait Session</option>' +
                  '<option>Commercial Photography</option>' +
                  '<option>Brand Campaign</option>' +
                  '<option>Fine Art / Creative Session</option>' +
                  '<option>Event Documentation</option>' +
                '</select>' +
              '</label>' +
              '<fieldset class="booking-modal__services">' +
                '<legend>Select services</legend>' +
                '<p>Choose one or more</p>' +
                '<label><input type="checkbox" name="services" value="Brand Photography"><span>Brand Photography</span></label>' +
                '<label><input type="checkbox" name="services" value="Commercial Photography"><span>Commercial Photography</span></label>' +
                '<label><input type="checkbox" name="services" value="Portraiture"><span>Portraiture</span></label>' +
                '<label><input type="checkbox" name="services" value="Product Photography"><span>Product Photography</span></label>' +
                '<label><input type="checkbox" name="services" value="Interior & Architectural Photography"><span>Interior & Architectural Photography</span></label>' +
                '<label><input type="checkbox" name="services" value="Hospitality Photography"><span>Hospitality Photography</span></label>' +
                '<label><input type="checkbox" name="services" value="Fine Art Photography"><span>Fine Art Photography</span></label>' +
              '</fieldset>' +
              '<label class="booking-modal__field booking-modal__field--wide">' +
                '<span>Tell us about your project</span>' +
                '<textarea name="project_details" maxlength="500" rows="5" placeholder="Share a few details about your vision..."></textarea>' +
                '<small data-booking-count>0/500</small>' +
              '</label>' +
              '<div class="booking-modal__footer">' +
                '<p><span aria-hidden="true">Cal</span><strong>Duration</strong><br>Typically 2 - 6 hours</p>' +
                '<button type="submit">' +
                  '<span>Next Step</span>' +
                  '<svg width="40" height="8" viewBox="0 0 40 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" stroke-width="1"/></svg>' +
                '</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>' +
      '</section>';
    document.body.appendChild(wrapper);
    return wrapper;
  }

  function getFocusable() {
    return modal.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
  }

  function openModal(trigger) {
    if (!modal) {
      modal = createModal();
      bindModal();
    }
    lastFocused = trigger || document.activeElement;
    modal.classList.add('booking-modal--open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('booking-modal-lock');
    setTimeout(function () {
      var dialog = modal.querySelector('.booking-modal__dialog');
      if (dialog) dialog.focus();
    }, 0);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('booking-modal--open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('booking-modal-lock');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function bindModal() {
    var closes = modal.querySelectorAll('[data-booking-close]');
    for (var i = 0; i < closes.length; i++) {
      closes[i].addEventListener('click', closeModal);
    }

    var textarea = modal.querySelector('textarea[maxlength]');
    var count = modal.querySelector('[data-booking-count]');
    if (textarea && count) {
      textarea.addEventListener('input', function () {
        count.textContent = textarea.value.length + '/500';
      });
    }

    modal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusable = getFocusable();
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  for (var i = 0; i < bookingTriggers.length; i++) {
    (function (trigger) {
      if (!isBookingTrigger(trigger)) return;
      trigger.setAttribute('data-booking-modal', '');
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        openModal(trigger);
      });
    })(bookingTriggers[i]);
  }

  window.lgndryBookingModal = { open: openModal, close: closeModal };
}());
