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
