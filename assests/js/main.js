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
