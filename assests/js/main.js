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
    // When the scroll-driven hero sequence is present, scroll owns the
    // image transform — the load-time zoom animation would override it.
    if (document.querySelector('[data-hero-scroll]')) { return; }
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
    return window.matchMedia('(max-width: 767px)').matches;
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
    if (!isMobile()) {
      linksColumn.style.backgroundImage = '';
    }
  }

  function activateItem(item) {
    list.classList.add('nav-panel__list--hovering');
    for (var j = 0; j < items.length; j++) {
      items[j].classList.remove('nav-panel__item--hovered');
    }
    item.classList.add('nav-panel__item--hovered');
    setActivePhoto(item.getAttribute('data-nav-image'));
  }

  function syncMobilePhoto() {
    if (isMobile()) {
      setActivePhoto('home');
    } else {
      linksColumn.style.backgroundImage = '';
    }
  }

  for (var i = 0; i < items.length; i++) {
    (function (item) {
      item.addEventListener('mouseenter', function () { activateItem(item); });
      item.addEventListener('focus', function () { activateItem(item); });
      item.addEventListener('pointerdown', function () { activateItem(item); });
    })(items[i]);
  }

  list.addEventListener('mouseleave', clearHoverState);
  window.addEventListener('resize', syncMobilePhoto);
  syncMobilePhoto();
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

  for (var i = 0; i < buttons.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        for (var j = 0; j < buttons.length; j++) {
          buttons[j].classList.remove('collection-filter--active');
        }
        btn.classList.add('collection-filter--active');

        var filter = btn.getAttribute('data-filter');
        var cards = document.querySelectorAll('.work[data-category]');
        for (var k = 0; k < cards.length; k++) {
          var show = filter === 'all' || cards[k].getAttribute('data-category') === filter;
          cards[k].style.display = show ? '' : 'none';
        }
      });
    })(buttons[i]);
  }
}());


/* Collection cart and delivery journey */
(function () {
  var grid = document.querySelector('.collection-grid');
  if (!grid) return;

  var cart = [];
  var drawer;
  var cartButton;
  var lastFocused;
  var orderEmail = 'info@lgndry-co.co.za';

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function parsePrice(value) {
    var number = String(value || '').replace(/[^0-9.]/g, '');
    return parseFloat(number) || 0;
  }

  function formatMoney(value) {
    return 'R ' + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function getCartCount() {
    return cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
  }

  function getCartTotal() {
    return cart.reduce(function (sum, item) { return sum + (item.price * item.quantity); }, 0);
  }

  function getFormValue(name) {
    var field = drawer && drawer.querySelector('[name="' + name + '"]');
    return field ? field.value.trim() : '';
  }

  function getDeliverySummary() {
    var method = getFormValue('delivery_method') || '-';
    var address = getFormValue('delivery_address') || '-';
    var city = getFormValue('delivery_city') || '-';
    var code = getFormValue('postal_code') || '-';
    return method + ' / ' + address + ', ' + city + ', ' + code;
  }

  function createCartButton() {
    var filters = document.querySelector('[data-collection-filters]');
    if (!filters) return null;

    var button = document.createElement('button');
    button.className = 'collection-cart-button';
    button.type = 'button';
    button.setAttribute('data-collection-cart-open', '');
    button.innerHTML = 'Cart <span data-collection-cart-count>0</span>';
    filters.appendChild(button);
    button.addEventListener('click', function () { openDrawer(button); });
    return button;
  }

  function createDrawer() {
    var wrapper = document.createElement('div');
    wrapper.className = 'collection-cart';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = '' +
      '<div class="collection-cart__backdrop" data-collection-cart-close></div>' +
      '<aside class="collection-cart__dialog" role="dialog" aria-modal="true" aria-labelledby="collectionCartTitle" tabindex="-1">' +
        '<div class="collection-cart__header">' +
          '<div>' +
            '<p class="collection-cart__eyebrow">Collection order</p>' +
            '<h2 id="collectionCartTitle">Reserve your print.</h2>' +
            '<p>Add works to your cart, share delivery details, and we will confirm availability. Payment is made in person.</p>' +
          '</div>' +
          '<button class="collection-cart__close" type="button" aria-label="Close cart" data-collection-cart-close>&times;</button>' +
        '</div>' +
        '<form class="collection-cart__form" novalidate>' +
          '<div class="collection-cart__body">' +
            '<div class="collection-cart__items" data-collection-cart-items></div>' +
            '<section class="collection-cart__section">' +
              '<h3>Delivery details</h3>' +
              '<div class="collection-cart__grid">' +
                '<label class="collection-cart__field">' +
                  '<span>Your name</span>' +
                  '<input type="text" name="customer_name" autocomplete="name" required>' +
                '</label>' +
                '<label class="collection-cart__field">' +
                  '<span>Email address</span>' +
                  '<input type="email" name="customer_email" autocomplete="email" required>' +
                '</label>' +
                '<label class="collection-cart__field">' +
                  '<span>Phone / WhatsApp</span>' +
                  '<input type="tel" name="customer_phone" autocomplete="tel" required>' +
                '</label>' +
                '<label class="collection-cart__field">' +
                  '<span>Delivery method</span>' +
                  '<select name="delivery_method" required>' +
                    '<option value="">Select method</option>' +
                    '<option>Deliver to my address</option>' +
                    '<option>Collect in person</option>' +
                  '</select>' +
                '</label>' +
                '<label class="collection-cart__field collection-cart__field--wide">' +
                  '<span>Delivery address</span>' +
                  '<input type="text" name="delivery_address" autocomplete="street-address" placeholder="Street address, building, or collection note" required>' +
                '</label>' +
                '<label class="collection-cart__field">' +
                  '<span>City / town</span>' +
                  '<input type="text" name="delivery_city" autocomplete="address-level2" required>' +
                '</label>' +
                '<label class="collection-cart__field">' +
                  '<span>Postal code</span>' +
                  '<input type="text" name="postal_code" autocomplete="postal-code" required>' +
                '</label>' +
                '<label class="collection-cart__field collection-cart__field--wide">' +
                  '<span>Delivery notes</span>' +
                  '<textarea name="delivery_notes" rows="4" placeholder="Framing requests, preferred delivery day, access notes, or anything we should know."></textarea>' +
                '</label>' +
              '</div>' +
              '<div class="collection-cart__payment">' +
                '<strong>Payment in person</strong>' +
                '<p>No online payment is collected here. LGNDRY.Co will confirm print availability, delivery or collection details, and arrange in-person payment.</p>' +
              '</div>' +
            '</section>' +
            '<section class="collection-cart__section">' +
              '<h3>Review request</h3>' +
              '<dl class="collection-cart__review" data-collection-cart-review></dl>' +
            '</section>' +
          '</div>' +
          '<div class="collection-cart__footer">' +
            '<p class="collection-cart__total"><span>Subtotal</span><strong data-collection-cart-total>R 0</strong></p>' +
            '<button type="submit" data-collection-cart-submit>Send order request</button>' +
          '</div>' +
        '</form>' +
      '</aside>';
    document.body.appendChild(wrapper);
    return wrapper;
  }

  function getFocusable() {
    return drawer.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
  }

  function updateButton() {
    if (!cartButton) return;
    var count = cartButton.querySelector('[data-collection-cart-count]');
    if (count) count.textContent = getCartCount();
    cartButton.setAttribute('aria-label', 'Open cart with ' + getCartCount() + ' item' + (getCartCount() === 1 ? '' : 's'));
  }

  function renderItems() {
    var container = drawer.querySelector('[data-collection-cart-items]');
    if (!container) return;

    if (!cart.length) {
      container.innerHTML = '' +
        '<div class="collection-cart__empty">' +
          '<p>Your cart is empty.</p>' +
          '<button type="button" data-collection-cart-close>Continue browsing</button>' +
        '</div>';
      var close = container.querySelector('[data-collection-cart-close]');
      if (close) close.addEventListener('click', closeDrawer);
      return;
    }

    container.innerHTML = cart.map(function (item, index) {
      return '' +
        '<article class="collection-cart__item">' +
          '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.title) + '">' +
          '<div>' +
            '<h3>' + escapeHtml(item.title) + '</h3>' +
            '<p class="collection-cart__item-meta">' + escapeHtml(item.year) + ' / ' + escapeHtml(item.size) + '<br>' + escapeHtml(item.details) + '</p>' +
            '<div class="collection-cart__item-row">' +
              '<div class="collection-cart__qty" aria-label="Quantity for ' + escapeHtml(item.title) + '">' +
                '<button type="button" data-collection-cart-qty="-1" data-index="' + index + '">-</button>' +
                '<span>' + item.quantity + '</span>' +
                '<button type="button" data-collection-cart-qty="1" data-index="' + index + '">+</button>' +
              '</div>' +
              '<p class="collection-cart__price">' + formatMoney(item.price * item.quantity) + '</p>' +
            '</div>' +
            '<button class="collection-cart__remove" type="button" data-collection-cart-remove data-index="' + index + '">Remove</button>' +
          '</div>' +
        '</article>';
    }).join('');

    var qtyButtons = container.querySelectorAll('[data-collection-cart-qty]');
    for (var i = 0; i < qtyButtons.length; i++) {
      qtyButtons[i].addEventListener('click', function () {
        var index = parseInt(this.getAttribute('data-index'), 10);
        var delta = parseInt(this.getAttribute('data-collection-cart-qty'), 10);
        if (!cart[index]) return;
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) cart.splice(index, 1);
        renderCart();
      });
    }

    var removeButtons = container.querySelectorAll('[data-collection-cart-remove]');
    for (var r = 0; r < removeButtons.length; r++) {
      removeButtons[r].addEventListener('click', function () {
        var index = parseInt(this.getAttribute('data-index'), 10);
        if (!cart[index]) return;
        cart.splice(index, 1);
        renderCart();
      });
    }
  }

  function renderReview() {
    var review = drawer.querySelector('[data-collection-cart-review]');
    if (!review) return;

    var itemText = cart.length ? cart.map(function (item) {
      return item.quantity + ' x ' + item.title + ' (' + item.size + ')';
    }).join(', ') : '-';

    review.innerHTML = '' +
      '<div><dt>Works</dt><dd>' + escapeHtml(itemText) + '</dd></div>' +
      '<div><dt>Customer</dt><dd>' + escapeHtml(getFormValue('customer_name') || '-') + '<br>' + escapeHtml(getFormValue('customer_email') || '-') + '<br>' + escapeHtml(getFormValue('customer_phone') || '-') + '</dd></div>' +
      '<div><dt>Delivery</dt><dd>' + escapeHtml(getDeliverySummary()) + '</dd></div>' +
      '<div><dt>Notes</dt><dd>' + escapeHtml(getFormValue('delivery_notes') || 'None') + '</dd></div>' +
      '<div><dt>Payment</dt><dd>Payment will be made in person after availability and delivery details are confirmed.</dd></div>';
  }

  function renderCart() {
    renderItems();
    renderReview();
    updateButton();

    var total = drawer.querySelector('[data-collection-cart-total]');
    if (total) total.textContent = formatMoney(getCartTotal());

    var submit = drawer.querySelector('[data-collection-cart-submit]');
    if (submit) submit.disabled = cart.length === 0;
  }

  function getProductFromCard(card) {
    var title = card.querySelector('.work__title');
    var year = card.querySelector('.work__year');
    var price = card.querySelector('.work__price');
    var image = card.querySelector('.work__media img');
    var size = card.querySelector('.work__size select');
    var details = [];
    var meta = card.querySelectorAll('.work__meta p');
    for (var i = 0; i < meta.length; i++) details.push(meta[i].textContent.trim());

    return {
      title: title ? title.textContent.trim() : 'Untitled work',
      year: year ? year.textContent.trim() : '',
      priceText: price ? price.textContent.trim() : 'R 0',
      price: parsePrice(price ? price.textContent : '0'),
      image: image ? image.getAttribute('src') : '',
      size: size ? size.value : '',
      details: details.join(' / '),
      quantity: 1
    };
  }

  function addToCart(card, trigger) {
    var product = getProductFromCard(card);
    var id = product.title + '|' + product.size;
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) existing = cart[i];
    }

    if (existing) {
      existing.quantity += 1;
    } else {
      product.id = id;
      cart.push(product);
    }

    openDrawer(trigger);
    renderCart();
  }

  function openDrawer(trigger) {
    if (!drawer) {
      drawer = createDrawer();
      bindDrawer();
    }
    lastFocused = trigger || document.activeElement;
    drawer.classList.add('collection-cart--open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('collection-cart-lock');
    renderCart();
    setTimeout(function () {
      var dialog = drawer.querySelector('.collection-cart__dialog');
      if (dialog) dialog.focus();
    }, 0);
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('collection-cart--open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('collection-cart-lock');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function buildOrderBody() {
    var lines = [
      'LGNDRY.Co collection order request',
      '',
      'Items:'
    ];

    for (var i = 0; i < cart.length; i++) {
      lines.push('- ' + cart[i].quantity + ' x ' + cart[i].title + ' / ' + cart[i].size + ' / ' + formatMoney(cart[i].price * cart[i].quantity));
    }

    lines.push('');
    lines.push('Subtotal: ' + formatMoney(getCartTotal()));
    lines.push('Payment: In person after availability and delivery details are confirmed.');
    lines.push('');
    lines.push('Customer: ' + getFormValue('customer_name'));
    lines.push('Email: ' + getFormValue('customer_email'));
    lines.push('Phone / WhatsApp: ' + getFormValue('customer_phone'));
    lines.push('Delivery method: ' + getFormValue('delivery_method'));
    lines.push('Delivery address: ' + getFormValue('delivery_address'));
    lines.push('City / town: ' + getFormValue('delivery_city'));
    lines.push('Postal code: ' + getFormValue('postal_code'));
    lines.push('Delivery notes: ' + (getFormValue('delivery_notes') || 'None'));

    return lines.join('\n');
  }

  function submitOrder(e) {
    e.preventDefault();
    if (!cart.length) {
      openDrawer();
      return;
    }

    var form = drawer.querySelector('.collection-cart__form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    renderReview();
    var subject = encodeURIComponent('Collection order request - LGNDRY.Co');
    var body = encodeURIComponent(buildOrderBody());
    window.location.href = 'mailto:' + orderEmail + '?subject=' + subject + '&body=' + body;
  }

  function bindDrawer() {
    var closes = drawer.querySelectorAll('[data-collection-cart-close]');
    for (var i = 0; i < closes.length; i++) {
      closes[i].addEventListener('click', closeDrawer);
    }

    var form = drawer.querySelector('.collection-cart__form');
    if (form) {
      form.addEventListener('input', renderReview);
      form.addEventListener('change', renderReview);
      form.addEventListener('submit', submitOrder);
    }

    drawer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeDrawer();
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

  grid.addEventListener('click', function (e) {
    var trigger = e.target.closest('.work__acquire');
    if (!trigger) return;
    var card = trigger.closest('.work');
    if (!card) return;
    e.preventDefault();
    addToCart(card, trigger);
  });

  cartButton = createCartButton();
  updateButton();
}());
/* Shared: replace a budget <select>'s options with live values from the Command Center */
function populateBudgetSelect(select, form) {
  if (!select || !window.LgndrySiteData || !window.LgndrySiteData.fetchBudgetOptions) return;
  var previousValue = select.value;
  window.LgndrySiteData.fetchBudgetOptions(form).then(function (labels) {
    if (!labels.length) return;
    select.innerHTML = '<option value="">Select budget range</option>' + labels.map(function (label) {
      return '<option>' + label + '</option>';
    }).join('');
    if (previousValue && labels.indexOf(previousValue) !== -1) select.value = previousValue;
  }).catch(function (error) {
    console.error('Failed to load live budget options, showing static fallback.', error);
  });
}
/* Contact form: two-phase lead qualification */
(function () {
  var forms = document.querySelectorAll('[data-contact-form]');
  if (!forms.length) return;

  for (var f = 0; f < forms.length; f++) {
    populateBudgetSelect(forms[f].querySelector('[name="budget_range"]'), 'Contact');
  }

  function validatePhase(phase) {
    var fields = phase.querySelectorAll('input, select, textarea');
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].checkValidity()) {
        fields[i].reportValidity();
        return false;
      }
    }
    return true;
  }

  function setPhase(form, index) {
    var phases = form.querySelectorAll('[data-contact-phase]');
    var steps = form.querySelectorAll('[data-contact-step]');
    for (var i = 0; i < phases.length; i++) {
      var active = i === index;
      phases[i].hidden = !active;
      phases[i].classList.toggle('contact-form__phase--active', active);
      if (steps[i]) steps[i].classList.toggle('contact-form__step--active', active);
    }

    var target = phases[index] && phases[index].querySelector('input, select, textarea, button');
    if (target && target.focus) target.focus();
  }

  function submitContactForm(form) {
    var submitBtn = form.querySelector('.contact-submit[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.querySelector('span').textContent = 'Sending...'; }

    function value(name) {
      var field = form.querySelector('[name="' + name + '"]');
      return field ? field.value : '';
    }

    var fields = {
      assistance_needed: value('assistance_needed'),
      project_readiness: value('project_readiness'),
      timeline: value('timeline'),
      budget_range: value('budget_range'),
      message: value('message'),
      name: value('name'),
      email: value('email'),
      phone: value('phone'),
      company: value('company')
    };

    if (!window.LgndrySiteData || !window.LgndrySiteData.submitContactLead) {
      handleContactFailure(submitBtn);
      return;
    }

    window.LgndrySiteData.submitContactLead(fields).then(function () {
      form.innerHTML = '<div class="contact-form__section contact-form__section--success">' +
        '<svg class="form-success__icon" width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1"/><path d="M15 24.5L21 30.5L33 17.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<h3>Message sent</h3>' +
        '<p>Thank you for reaching out. We will be in touch within 24 hours.</p>' +
      '</div>';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function (error) {
      console.error('Contact form submission failed', error);
      handleContactFailure(submitBtn);
    });
  }

  function handleContactFailure(submitBtn) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.querySelector('span').textContent = 'Send message'; }
    var actions = submitBtn ? submitBtn.closest('.contact-form__actions') : null;
    if (!actions) return;
    var note = actions.parentNode.querySelector('[data-contact-error]') || document.createElement('p');
    note.setAttribute('data-contact-error', '');
    note.className = 'contact-form__error';
    note.textContent = 'Something went wrong sending your message. Please try again or email us directly at info@lgndry-co.co.za.';
    actions.parentNode.insertBefore(note, actions);
  }

  for (var i = 0; i < forms.length; i++) {
    (function (form) {
      var next = form.querySelector('[data-contact-next]');
      var back = form.querySelector('[data-contact-back]');
      var firstPhase = form.querySelector('[data-contact-phase="0"]');

      if (next && firstPhase) {
        next.addEventListener('click', function () {
          if (validatePhase(firstPhase)) setPhase(form, 1);
        });
      }

      if (back) {
        back.addEventListener('click', function () {
          setPhase(form, 0);
        });
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var secondPhase = form.querySelector('[data-contact-phase="1"]');
        if (secondPhase && !validatePhase(secondPhase)) return;
        submitContactForm(form);
      });
    })(forms[i]);
  }
}());
/* Booking modal */
(function () {
  var bookingTriggers = document.querySelectorAll('a, button');
  var modal;
  var lastFocused;
  var currentStep = 0;
  var stepLabels = ['Session Type', 'Date & Time', 'Your Details', 'Review & Confirm'];

  function isBookingTrigger(el) {
    if (!el) return false;
    if (el.hasAttribute('data-booking-modal')) return true;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var href = (el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    return /(^|\b)book(\b|$)/.test(text) || href.indexOf('booking%20') !== -1;
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
            '<small data-booking-step-count>Step 1 of 4</small>' +
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
              '<li class="is-active"><button type="button" data-booking-step="0"><span>1</span><strong>Session Type</strong></button></li>' +
              '<li><button type="button" data-booking-step="1"><span>2</span><strong>Date & Time</strong></button></li>' +
              '<li><button type="button" data-booking-step="2"><span>3</span><strong>Your Details</strong></button></li>' +
              '<li><button type="button" data-booking-step="3"><span>4</span><strong>Review & Confirm</strong></button></li>' +
            '</ol>' +
            '<form class="booking-modal__form" action="mailto:info@lgndry-co.co.za" method="post" enctype="text/plain" novalidate>' +
              '<div class="booking-modal__panels">' +
                '<fieldset class="booking-modal__screen is-active" data-booking-panel="0">' +
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
                  '<fieldset class="booking-modal__services" data-booking-services>' +
                    '<legend>Select services</legend>' +
                    '<p>Choose one or more</p>' +
                    '<label><input type="checkbox" name="services" value="Brand Photography"><span>Brand Photography</span></label>' +
                    '<label><input type="checkbox" name="services" value="Commercial Photography"><span>Commercial Photography</span></label>' +
                    '<label><input type="checkbox" name="services" value="Portraiture"><span>Portraiture</span></label>' +
                    '<label><input type="checkbox" name="services" value="Product Photography"><span>Product Photography</span></label>' +
                    '<label><input type="checkbox" name="services" value="Interior & Architectural Photography"><span>Interior & Architectural Photography</span></label>' +
                    '<label><input type="checkbox" name="services" value="Hospitality Photography"><span>Hospitality Photography</span></label>' +
                    '<label><input type="checkbox" name="services" value="Fine Art Photography"><span>Fine Art Photography</span></label>' +
                    '<small class="booking-modal__error" data-booking-service-error>Select at least one service.</small>' +
                  '</fieldset>' +
                  '<label class="booking-modal__field booking-modal__field--wide">' +
                    '<span>Tell us about your project</span>' +
                    '<textarea name="project_details" maxlength="500" rows="5" placeholder="Share a few details about your vision..." required></textarea>' +
                    '<small data-booking-count>0/500</small>' +
                  '</label>' +
                '</fieldset>' +
                '<fieldset class="booking-modal__screen" data-booking-panel="1">' +
                  '<div class="booking-modal__grid">' +
                    '<label class="booking-modal__field">' +
                      '<span>Preferred date</span>' +
                      '<input type="date" name="preferred_date" required>' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Preferred time</span>' +
                      '<input type="time" name="preferred_time" required>' +
                    '</label>' +
                    '<label class="booking-modal__field booking-modal__field--wide">' +
                      '<span>Where should the session happen?</span>' +
                      '<input type="text" name="session_location" placeholder="Studio, venue, town, or online brief" required>' +
                    '</label>' +
                    '<label class="booking-modal__field booking-modal__field--wide">' +
                      '<span>Date flexibility</span>' +
                      '<select name="date_flexibility" required>' +
                        '<option value="">Select flexibility</option>' +
                        '<option>Exact date only</option>' +
                        '<option>Flexible by a few days</option>' +
                        '<option>Flexible by a week or more</option>' +
                      '</select>' +
                    '</label>' +
                  '</div>' +
                '</fieldset>' +
                '<fieldset class="booking-modal__screen" data-booking-panel="2">' +
                  '<div class="booking-modal__grid">' +
                    '<label class="booking-modal__field">' +
                      '<span>Your name</span>' +
                      '<input type="text" name="client_name" autocomplete="name" required>' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Email address</span>' +
                      '<input type="email" name="client_email" autocomplete="email" required>' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Phone / WhatsApp</span>' +
                      '<input type="tel" name="client_phone" autocomplete="tel" required>' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Company / brand</span>' +
                      '<input type="text" name="company" autocomplete="organization" placeholder="Optional">' +
                    '</label>' +
                    '<label class="booking-modal__field booking-modal__field--wide">' +
                      '<span>Estimated budget</span>' +
                      '<select name="budget" required>' +
                        '<option value="">Select budget range</option>' +
                        '<option>Under R5,000</option>' +
                        '<option>R5,000 - R10,000</option>' +
                        '<option>R10,000 - R25,000</option>' +
                        '<option>R25,000+</option>' +
                      '</select>' +
                    '</label>' +
                  '</div>' +
                '</fieldset>' +
                '<fieldset class="booking-modal__screen" data-booking-panel="3">' +
                  '<div class="booking-modal__review" data-booking-review></div>' +
                  '<label class="booking-modal__confirm">' +
                    '<input type="checkbox" name="confirm_details" required>' +
                    '<span>I confirm these details are accurate and LGNDRY.Co may contact me about this booking.</span>' +
                  '</label>' +
                '</fieldset>' +
              '</div>' +
              '<div class="booking-modal__footer">' +
                '<p><span aria-hidden="true">Cal</span><strong data-booking-footer-title>Duration</strong><br><em data-booking-footer-copy>Typically 2 - 6 hours</em></p>' +
                '<div class="booking-modal__actions">' +
                  '<button class="booking-modal__back" type="button" data-booking-back>Back</button>' +
                  '<button class="booking-modal__next" type="button" data-booking-next>' +
                    '<span>Next Step</span>' +
                    '<svg width="40" height="8" viewBox="0 0 40 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" stroke-width="1"/></svg>' +
                  '</button>' +
                '</div>' +
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

  function getPanels() {
    return modal.querySelectorAll('[data-booking-panel]');
  }

  function getStepItems() {
    return modal.querySelectorAll('.booking-modal__steps li');
  }

  function getCheckedValues(name) {
    var values = [];
    var checked = modal.querySelectorAll('input[name="' + name + '"]:checked');
    for (var i = 0; i < checked.length; i++) {
      values.push(checked[i].value);
    }
    return values;
  }

  function getValue(name) {
    var field = modal.querySelector('[name="' + name + '"]');
    return field ? field.value : '';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char];
    });
  }

  function setStep(step) {
    currentStep = Math.max(0, Math.min(step, stepLabels.length - 1));
    var panels = getPanels();
    var steps = getStepItems();

    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.toggle('is-active', i === currentStep);
    }

    for (var j = 0; j < steps.length; j++) {
      steps[j].classList.toggle('is-active', j === currentStep);
      steps[j].classList.toggle('is-complete', j < currentStep);
    }

    var visualStep = modal.querySelector('[data-booking-step-count]');
    if (visualStep) visualStep.textContent = 'Step ' + (currentStep + 1) + ' of 4';

    var back = modal.querySelector('[data-booking-back]');
    var next = modal.querySelector('[data-booking-next]');
    if (back) back.disabled = currentStep === 0;
    if (next) {
      next.setAttribute('type', currentStep === stepLabels.length - 1 ? 'submit' : 'button');
      next.querySelector('span').textContent = currentStep === stepLabels.length - 1 ? 'Send Request' : 'Next Step';
    }

    var footerTitle = modal.querySelector('[data-booking-footer-title]');
    var footerCopy = modal.querySelector('[data-booking-footer-copy]');
    if (footerTitle && footerCopy) {
      footerTitle.textContent = currentStep === 1 ? 'Scheduling' : currentStep === 2 ? 'Contact' : currentStep === 3 ? 'Ready' : 'Duration';
      footerCopy.textContent = currentStep === 1 ? 'Choose your preferred date' : currentStep === 2 ? 'Tell us how to reach you' : currentStep === 3 ? 'Review before sending' : 'Typically 2 - 6 hours';
    }

    if (currentStep === 3) updateReview();

    var panel = modal.querySelector('.booking-modal__panel');
    if (panel) panel.scrollTop = 0;
  }

  function validateServices() {
    var services = modal.querySelector('[data-booking-services]');
    var error = modal.querySelector('[data-booking-service-error]');
    var isValid = getCheckedValues('services').length > 0;
    if (services) services.classList.toggle('has-error', !isValid);
    if (error) error.classList.toggle('is-visible', !isValid);
    return isValid;
  }

  function validateStep(step) {
    var panel = modal.querySelector('[data-booking-panel="' + step + '"]');
    if (!panel) return true;

    var fields = panel.querySelectorAll('input, select, textarea');
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].checkValidity()) {
        fields[i].reportValidity();
        return false;
      }
    }

    if (step === 0 && !validateServices()) {
      var firstService = panel.querySelector('input[name="services"]');
      if (firstService) firstService.focus();
      return false;
    }

    return true;
  }

  function validateUpTo(targetStep) {
    for (var i = 0; i < targetStep; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return false;
      }
    }
    return true;
  }

  function updateReview() {
    var review = modal.querySelector('[data-booking-review]');
    if (!review) return;

    var services = getCheckedValues('services');
    review.innerHTML = '' +
      '<h3>Review your booking</h3>' +
      '<dl>' +
        '<div><dt>Session type</dt><dd>' + escapeHtml(getValue('session_type') || '-') + '</dd></div>' +
        '<div><dt>Services</dt><dd>' + escapeHtml(services.length ? services.join(', ') : '-') + '</dd></div>' +
        '<div><dt>Project</dt><dd>' + escapeHtml(getValue('project_details') || '-') + '</dd></div>' +
        '<div><dt>Date and time</dt><dd>' + escapeHtml(getValue('preferred_date') || '-') + ' at ' + escapeHtml(getValue('preferred_time') || '-') + '</dd></div>' +
        '<div><dt>Location</dt><dd>' + escapeHtml(getValue('session_location') || '-') + '</dd></div>' +
        '<div><dt>Flexibility</dt><dd>' + escapeHtml(getValue('date_flexibility') || '-') + '</dd></div>' +
        '<div><dt>Name</dt><dd>' + escapeHtml(getValue('client_name') || '-') + '</dd></div>' +
        '<div><dt>Email</dt><dd>' + escapeHtml(getValue('client_email') || '-') + '</dd></div>' +
        '<div><dt>Phone</dt><dd>' + escapeHtml(getValue('client_phone') || '-') + '</dd></div>' +
        '<div><dt>Company</dt><dd>' + escapeHtml(getValue('company') || 'Not provided') + '</dd></div>' +
        '<div><dt>Budget</dt><dd>' + escapeHtml(getValue('budget') || '-') + '</dd></div>' +
      '</dl>';
  }

  function resetModal() {
    currentStep = 0;
    var form = modal && modal.querySelector('.booking-modal__form');
    if (form) form.reset();
    var count = modal && modal.querySelector('[data-booking-count]');
    if (count) count.textContent = '0/500';
    var serviceError = modal && modal.querySelector('[data-booking-service-error]');
    if (serviceError) serviceError.classList.remove('is-visible');
    var services = modal && modal.querySelector('[data-booking-services]');
    if (services) services.classList.remove('has-error');
    if (modal) setStep(0);
  }

  function openModal(trigger) {
    if (!modal) {
      modal = createModal();
      bindModal();
      populateBudgetSelect(modal.querySelector('select[name="budget"]'), 'Booking');
    }
    lastFocused = trigger || document.activeElement;
    resetModal();
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

    var serviceInputs = modal.querySelectorAll('input[name="services"]');
    for (var s = 0; s < serviceInputs.length; s++) {
      serviceInputs[s].addEventListener('change', validateServices);
    }

    var stepButtons = modal.querySelectorAll('[data-booking-step]');
    for (var b = 0; b < stepButtons.length; b++) {
      stepButtons[b].addEventListener('click', function () {
        var target = parseInt(this.getAttribute('data-booking-step'), 10);
        if (target <= currentStep || validateUpTo(target)) setStep(target);
      });
    }

    var back = modal.querySelector('[data-booking-back]');
    if (back) {
      back.addEventListener('click', function () {
        setStep(currentStep - 1);
      });
    }

    var next = modal.querySelector('[data-booking-next]');
    if (next) {
      next.addEventListener('click', function (e) {
        if (currentStep < stepLabels.length - 1) {
          e.preventDefault();
          if (validateStep(currentStep)) setStep(currentStep + 1);
        }
      });
    }

    var form = modal.querySelector('.booking-modal__form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateUpTo(stepLabels.length - 1) || !validateStep(stepLabels.length - 1)) return;
        submitBookingRequest();
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

  function submitBookingRequest() {
    var next = modal.querySelector('[data-booking-next]');
    var back = modal.querySelector('[data-booking-back]');
    var review = modal.querySelector('[data-booking-review]');
    if (next) { next.disabled = true; next.querySelector('span').textContent = 'Sending...'; }

    if (!window.LgndrySiteData || !window.LgndrySiteData.submitBooking) {
      handleSubmitFailure(next, review);
      return;
    }

    window.LgndrySiteData.submitBooking({
      session_type: getValue('session_type'),
      services: getCheckedValues('services').join(', '),
      project_details: getValue('project_details'),
      preferred_date: getValue('preferred_date'),
      preferred_time: getValue('preferred_time'),
      session_location: getValue('session_location'),
      date_flexibility: getValue('date_flexibility'),
      client_name: getValue('client_name'),
      client_email: getValue('client_email'),
      client_phone: getValue('client_phone'),
      company: getValue('company'),
      budget: getValue('budget')
    }).then(function () {
      if (review) {
        review.innerHTML = '<div class="booking-modal__success">' +
          '<svg class="form-success__icon" width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1"/><path d="M15 24.5L21 30.5L33 17.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<h3>Request sent</h3>' +
          '<p>Thank you — your booking enquiry has been sent to LGNDRY.Co. We will be in touch within 24 hours.</p>' +
        '</div>';
      }
      var scrollPanel = modal.querySelector('.booking-modal__panel');
      if (scrollPanel) scrollPanel.scrollTop = 0;
      if (next) next.hidden = true;
      if (back) back.hidden = true;
    }).catch(function (error) {
      console.error('Booking submission failed', error);
      handleSubmitFailure(next, review);
    });
  }

  function handleSubmitFailure(next, review) {
    if (next) { next.disabled = false; next.querySelector('span').textContent = 'Send Request'; }
    if (review) {
      var note = review.querySelector('[data-booking-submit-error]') || document.createElement('p');
      note.setAttribute('data-booking-submit-error', '');
      note.className = 'booking-modal__error is-visible';
      note.textContent = 'Something went wrong sending your request. Please try again or email us directly at info@lgndry-co.co.za.';
      review.appendChild(note);
    }
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

/* Brand partnership application modal */
(function () {
  var triggers = document.querySelectorAll('a, button');
  var modal;
  var lastFocused;
  var currentStep = 0;
  var stepLabels = ['Partnership', 'Your Brand', 'Your Details', 'Review & Confirm'];

  function isPartnerTrigger(el) {
    if (!el) return false;
    if (el.hasAttribute('data-partnership-modal')) return true;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var href = (el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    return text.indexOf('apply to partner') !== -1 || href.indexOf('brand%20partnership') !== -1;
  }

  function createModal() {
    var wrapper = document.createElement('div');
    wrapper.className = 'booking-modal booking-modal--partnership';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = '' +
      '<div class="booking-modal__backdrop" data-booking-close></div>' +
      '<section class="booking-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="partnershipModalTitle" tabindex="-1">' +
        '<button class="booking-modal__close" type="button" aria-label="Close partnership form" data-booking-close>' +
          '<span></span><span></span>' +
        '</button>' +
        '<aside class="booking-modal__visual" aria-hidden="true">' +
          '<div class="booking-modal__brand">' +
            '<strong>LGNDRY.CO</strong>' +
            '<span>Brand Partnerships</span>' +
          '</div>' +
          '<div class="booking-modal__visual-copy">' +
            '<p>Let\'s build<br>something<br>that<br>lasts.</p>' +
            '<span></span>' +
            '<small data-booking-step-count>Step 1 of 4</small>' +
          '</div>' +
        '</aside>' +
        '<div class="booking-modal__panel">' +
          '<div class="booking-modal__intro">' +
            '<p class="booking-modal__eyebrow">Brand Partnership</p>' +
            '<h2 id="partnershipModalTitle">Let\'s build a partnership.</h2>' +
            '<p>Tell us about your brand and we\'ll be in touch within 48 hours.</p>' +
            '<span class="booking-modal__rule" aria-hidden="true"></span>' +
          '</div>' +
          '<div class="booking-modal__content">' +
            '<ol class="booking-modal__steps" aria-label="Application steps">' +
              '<li class="is-active"><button type="button" data-booking-step="0"><span>1</span><strong>Partnership</strong></button></li>' +
              '<li><button type="button" data-booking-step="1"><span>2</span><strong>Your Brand</strong></button></li>' +
              '<li><button type="button" data-booking-step="2"><span>3</span><strong>Your Details</strong></button></li>' +
              '<li><button type="button" data-booking-step="3"><span>4</span><strong>Review & Confirm</strong></button></li>' +
            '</ol>' +
            '<form class="booking-modal__form" action="mailto:info@lgndry-co.co.za" method="post" enctype="text/plain" novalidate>' +
              '<div class="booking-modal__panels">' +
                '<fieldset class="booking-modal__screen is-active" data-booking-panel="0">' +
                  '<label class="booking-modal__field booking-modal__field--wide">' +
                    '<span>What kind of partnership are you exploring?</span>' +
                    '<select name="partnership_type" required>' +
                      '<option value="">Select partnership type</option>' +
                      '<option>Creative Partnership</option>' +
                      '<option>Visual Content Partnership</option>' +
                      '<option>Campaign Production</option>' +
                      '<option>Dedicated Visual Partner</option>' +
                      '<option>Not sure yet</option>' +
                    '</select>' +
                  '</label>' +
                  '<fieldset class="booking-modal__services" data-booking-services>' +
                    '<legend>What do you need?</legend>' +
                    '<p>Choose one or more</p>' +
                    '<label><input type="checkbox" name="focus" value="Ongoing Photography"><span>Ongoing Photography</span></label>' +
                    '<label><input type="checkbox" name="focus" value="Social & Content Creation"><span>Social & Content Creation</span></label>' +
                    '<label><input type="checkbox" name="focus" value="Campaign Production"><span>Campaign Production</span></label>' +
                    '<label><input type="checkbox" name="focus" value="Creative Direction"><span>Creative Direction</span></label>' +
                    '<label><input type="checkbox" name="focus" value="Brand Storytelling"><span>Brand Storytelling</span></label>' +
                    '<label><input type="checkbox" name="focus" value="Product & Lifestyle"><span>Product & Lifestyle</span></label>' +
                    '<small class="booking-modal__error" data-booking-service-error>Select at least one focus area.</small>' +
                  '</fieldset>' +
                  '<label class="booking-modal__field booking-modal__field--wide">' +
                    '<span>Tell us about your brand and goals</span>' +
                    '<textarea name="brand_goals" maxlength="500" rows="5" placeholder="Who you are, what you make, and what you\'re hoping to build together..." required></textarea>' +
                    '<small data-booking-count>0/500</small>' +
                  '</label>' +
                '</fieldset>' +
                '<fieldset class="booking-modal__screen" data-booking-panel="1">' +
                  '<div class="booking-modal__grid">' +
                    '<label class="booking-modal__field">' +
                      '<span>Company / brand name</span>' +
                      '<input type="text" name="company" autocomplete="organization" required>' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Industry</span>' +
                      '<input type="text" name="industry" placeholder="e.g. Hospitality, Fashion, Property" required>' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Website or Instagram</span>' +
                      '<input type="text" name="brand_link" placeholder="Optional">' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Location</span>' +
                      '<input type="text" name="brand_location" placeholder="City / country" required>' +
                    '</label>' +
                    '<label class="booking-modal__field booking-modal__field--wide">' +
                      '<span>How often do you need content?</span>' +
                      '<select name="content_frequency" required>' +
                        '<option value="">Select frequency</option>' +
                        '<option>Monthly</option>' +
                        '<option>Quarterly</option>' +
                        '<option>Per campaign</option>' +
                        '<option>One-off to start</option>' +
                      '</select>' +
                    '</label>' +
                  '</div>' +
                '</fieldset>' +
                '<fieldset class="booking-modal__screen" data-booking-panel="2">' +
                  '<div class="booking-modal__grid">' +
                    '<label class="booking-modal__field">' +
                      '<span>Your name</span>' +
                      '<input type="text" name="contact_name" autocomplete="name" required>' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Your role</span>' +
                      '<input type="text" name="contact_role" placeholder="Optional">' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Email address</span>' +
                      '<input type="email" name="contact_email" autocomplete="email" required>' +
                    '</label>' +
                    '<label class="booking-modal__field">' +
                      '<span>Phone / WhatsApp</span>' +
                      '<input type="tel" name="contact_phone" autocomplete="tel" required>' +
                    '</label>' +
                    '<label class="booking-modal__field booking-modal__field--wide">' +
                      '<span>Estimated monthly budget</span>' +
                      '<select name="partner_budget" required>' +
                        '<option value="">Select budget range</option>' +
                        '<option>Under R10,000 / month</option>' +
                        '<option>R10,000 - R25,000 / month</option>' +
                        '<option>R25,000 - R50,000 / month</option>' +
                        '<option>R50,000+ / month</option>' +
                        '<option>To be discussed</option>' +
                      '</select>' +
                    '</label>' +
                  '</div>' +
                '</fieldset>' +
                '<fieldset class="booking-modal__screen" data-booking-panel="3">' +
                  '<div class="booking-modal__review" data-booking-review></div>' +
                  '<label class="booking-modal__confirm">' +
                    '<input type="checkbox" name="confirm_details" required>' +
                    '<span>I confirm these details are accurate and LGNDRY.Co may contact me about this partnership.</span>' +
                  '</label>' +
                '</fieldset>' +
              '</div>' +
              '<div class="booking-modal__footer">' +
                '<p><span aria-hidden="true">Cal</span><strong data-booking-footer-title>Partnership</strong><br><em data-booking-footer-copy>Ongoing visual content partnerships</em></p>' +
                '<div class="booking-modal__actions">' +
                  '<button class="booking-modal__back" type="button" data-booking-back>Back</button>' +
                  '<button class="booking-modal__next" type="button" data-booking-next>' +
                    '<span>Next Step</span>' +
                    '<svg width="40" height="8" viewBox="0 0 40 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" stroke-width="1"/></svg>' +
                  '</button>' +
                '</div>' +
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

  function getPanels() {
    return modal.querySelectorAll('[data-booking-panel]');
  }

  function getStepItems() {
    return modal.querySelectorAll('.booking-modal__steps li');
  }

  function getCheckedValues(name) {
    var values = [];
    var checked = modal.querySelectorAll('input[name="' + name + '"]:checked');
    for (var i = 0; i < checked.length; i++) {
      values.push(checked[i].value);
    }
    return values;
  }

  function getValue(name) {
    var field = modal.querySelector('[name="' + name + '"]');
    return field ? field.value : '';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char];
    });
  }

  function setStep(step) {
    currentStep = Math.max(0, Math.min(step, stepLabels.length - 1));
    var panels = getPanels();
    var steps = getStepItems();

    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.toggle('is-active', i === currentStep);
    }

    for (var j = 0; j < steps.length; j++) {
      steps[j].classList.toggle('is-active', j === currentStep);
      steps[j].classList.toggle('is-complete', j < currentStep);
    }

    var visualStep = modal.querySelector('[data-booking-step-count]');
    if (visualStep) visualStep.textContent = 'Step ' + (currentStep + 1) + ' of 4';

    var back = modal.querySelector('[data-booking-back]');
    var next = modal.querySelector('[data-booking-next]');
    if (back) back.disabled = currentStep === 0;
    if (next) {
      next.setAttribute('type', currentStep === stepLabels.length - 1 ? 'submit' : 'button');
      next.querySelector('span').textContent = currentStep === stepLabels.length - 1 ? 'Send Application' : 'Next Step';
    }

    var footerTitle = modal.querySelector('[data-booking-footer-title]');
    var footerCopy = modal.querySelector('[data-booking-footer-copy]');
    if (footerTitle && footerCopy) {
      footerTitle.textContent = currentStep === 1 ? 'Your brand' : currentStep === 2 ? 'Contact' : currentStep === 3 ? 'Ready' : 'Partnership';
      footerCopy.textContent = currentStep === 1 ? 'Tell us who you are' : currentStep === 2 ? 'How we\'ll reach you' : currentStep === 3 ? 'Review before sending' : 'Ongoing visual content partnerships';
    }

    if (currentStep === 3) updateReview();

    var panel = modal.querySelector('.booking-modal__panel');
    if (panel) panel.scrollTop = 0;
  }

  function validateFocus() {
    var services = modal.querySelector('[data-booking-services]');
    var error = modal.querySelector('[data-booking-service-error]');
    var isValid = getCheckedValues('focus').length > 0;
    if (services) services.classList.toggle('has-error', !isValid);
    if (error) error.classList.toggle('is-visible', !isValid);
    return isValid;
  }

  function validateStep(step) {
    var panel = modal.querySelector('[data-booking-panel="' + step + '"]');
    if (!panel) return true;

    var fields = panel.querySelectorAll('input, select, textarea');
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].checkValidity()) {
        fields[i].reportValidity();
        return false;
      }
    }

    if (step === 0 && !validateFocus()) {
      var firstFocus = panel.querySelector('input[name="focus"]');
      if (firstFocus) firstFocus.focus();
      return false;
    }

    return true;
  }

  function validateUpTo(targetStep) {
    for (var i = 0; i < targetStep; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return false;
      }
    }
    return true;
  }

  function updateReview() {
    var review = modal.querySelector('[data-booking-review]');
    if (!review) return;

    var focus = getCheckedValues('focus');
    review.innerHTML = '' +
      '<h3>Review your application</h3>' +
      '<dl>' +
        '<div><dt>Partnership type</dt><dd>' + escapeHtml(getValue('partnership_type') || '-') + '</dd></div>' +
        '<div><dt>Focus areas</dt><dd>' + escapeHtml(focus.length ? focus.join(', ') : '-') + '</dd></div>' +
        '<div><dt>Goals</dt><dd>' + escapeHtml(getValue('brand_goals') || '-') + '</dd></div>' +
        '<div><dt>Company</dt><dd>' + escapeHtml(getValue('company') || '-') + '</dd></div>' +
        '<div><dt>Industry</dt><dd>' + escapeHtml(getValue('industry') || '-') + '</dd></div>' +
        '<div><dt>Website</dt><dd>' + escapeHtml(getValue('brand_link') || 'Not provided') + '</dd></div>' +
        '<div><dt>Location</dt><dd>' + escapeHtml(getValue('brand_location') || '-') + '</dd></div>' +
        '<div><dt>Frequency</dt><dd>' + escapeHtml(getValue('content_frequency') || '-') + '</dd></div>' +
        '<div><dt>Name</dt><dd>' + escapeHtml(getValue('contact_name') || '-') + '</dd></div>' +
        '<div><dt>Role</dt><dd>' + escapeHtml(getValue('contact_role') || 'Not provided') + '</dd></div>' +
        '<div><dt>Email</dt><dd>' + escapeHtml(getValue('contact_email') || '-') + '</dd></div>' +
        '<div><dt>Phone</dt><dd>' + escapeHtml(getValue('contact_phone') || '-') + '</dd></div>' +
        '<div><dt>Budget</dt><dd>' + escapeHtml(getValue('partner_budget') || '-') + '</dd></div>' +
      '</dl>';
  }

  function resetModal() {
    currentStep = 0;
    var form = modal && modal.querySelector('.booking-modal__form');
    if (form) form.reset();
    var count = modal && modal.querySelector('[data-booking-count]');
    if (count) count.textContent = '0/500';
    var serviceError = modal && modal.querySelector('[data-booking-service-error]');
    if (serviceError) serviceError.classList.remove('is-visible');
    var services = modal && modal.querySelector('[data-booking-services]');
    if (services) services.classList.remove('has-error');
    if (modal) setStep(0);
  }

  function openModal(trigger) {
    if (!modal) {
      modal = createModal();
      bindModal();
      populateBudgetSelect(modal.querySelector('select[name="partner_budget"]'), 'Partnership');
    }
    lastFocused = trigger || document.activeElement;
    resetModal();
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

    var focusInputs = modal.querySelectorAll('input[name="focus"]');
    for (var s = 0; s < focusInputs.length; s++) {
      focusInputs[s].addEventListener('change', validateFocus);
    }

    var stepButtons = modal.querySelectorAll('[data-booking-step]');
    for (var b = 0; b < stepButtons.length; b++) {
      stepButtons[b].addEventListener('click', function () {
        var target = parseInt(this.getAttribute('data-booking-step'), 10);
        if (target <= currentStep || validateUpTo(target)) setStep(target);
      });
    }

    var back = modal.querySelector('[data-booking-back]');
    if (back) {
      back.addEventListener('click', function () {
        setStep(currentStep - 1);
      });
    }

    var next = modal.querySelector('[data-booking-next]');
    if (next) {
      next.addEventListener('click', function (e) {
        if (currentStep < stepLabels.length - 1) {
          e.preventDefault();
          if (validateStep(currentStep)) setStep(currentStep + 1);
        }
      });
    }

    var form = modal.querySelector('.booking-modal__form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateUpTo(stepLabels.length - 1) || !validateStep(stepLabels.length - 1)) return;
        submitPartnershipRequest();
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

  function submitPartnershipRequest() {
    var next = modal.querySelector('[data-booking-next]');
    var back = modal.querySelector('[data-booking-back]');
    var review = modal.querySelector('[data-booking-review]');
    if (next) { next.disabled = true; next.querySelector('span').textContent = 'Sending...'; }

    if (!window.LgndrySiteData || !window.LgndrySiteData.submitPartnership) {
      handlePartnershipFailure(next, review);
      return;
    }

    window.LgndrySiteData.submitPartnership({
      partnership_type: getValue('partnership_type'),
      focus: getCheckedValues('focus').join(', '),
      brand_goals: getValue('brand_goals'),
      company: getValue('company'),
      industry: getValue('industry'),
      brand_link: getValue('brand_link'),
      brand_location: getValue('brand_location'),
      content_frequency: getValue('content_frequency'),
      contact_name: getValue('contact_name'),
      contact_role: getValue('contact_role'),
      contact_email: getValue('contact_email'),
      contact_phone: getValue('contact_phone'),
      partner_budget: getValue('partner_budget')
    }).then(function () {
      if (review) {
        review.innerHTML = '<div class="booking-modal__success">' +
          '<svg class="form-success__icon" width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1"/><path d="M15 24.5L21 30.5L33 17.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<h3>Application sent</h3>' +
          '<p>Thank you — your partnership application has been sent to LGNDRY.Co. We will be in touch within 48 hours.</p>' +
        '</div>';
      }
      var scrollPanel = modal.querySelector('.booking-modal__panel');
      if (scrollPanel) scrollPanel.scrollTop = 0;
      if (next) next.hidden = true;
      if (back) back.hidden = true;
    }).catch(function (error) {
      console.error('Partnership submission failed', error);
      handlePartnershipFailure(next, review);
    });
  }

  function handlePartnershipFailure(next, review) {
    if (next) { next.disabled = false; next.querySelector('span').textContent = 'Send Request'; }
    if (review) {
      var note = review.querySelector('[data-booking-submit-error]') || document.createElement('p');
      note.setAttribute('data-booking-submit-error', '');
      note.className = 'booking-modal__error is-visible';
      note.textContent = 'Something went wrong sending your application. Please try again or email us directly at info@lgndry-co.co.za.';
      review.appendChild(note);
    }
  }

  for (var i = 0; i < triggers.length; i++) {
    (function (trigger) {
      if (!isPartnerTrigger(trigger)) return;
      trigger.setAttribute('data-partnership-modal', '');
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        openModal(trigger);
      });
    })(triggers[i]);
  }

  window.lgndryPartnershipModal = { open: openModal, close: closeModal };
}());


/* Collection: artwork series carousels */
(function () {
  var grid = document.querySelector('.collection-grid');
  if (!grid) return;

  function showSlide(media, index) {
    var images = JSON.parse(media.getAttribute('data-series-images'));
    var title = media.getAttribute('data-series-title');
    var nextIndex = (index + images.length) % images.length;
    var image = media.querySelector('img');
    var dots = media.querySelectorAll('[data-series-slide]');

    media.setAttribute('data-series-index', nextIndex);
    image.src = images[nextIndex];
    image.setAttribute('data-full-src', images[nextIndex]);
    image.alt = title + ' — image ' + (nextIndex + 1) + ' of ' + images.length;

    for (var i = 0; i < dots.length; i++) {
      var active = i === nextIndex;
      dots[i].classList.toggle('is-active', active);
      dots[i].setAttribute('aria-current', active ? 'true' : 'false');
    }
  }

  function enhanceCard(card) {
    if (card.hasAttribute('data-series-ready')) return;
    var titleEl = card.querySelector('.work__title');
    var media = card.querySelector('.work__media');
    var image = media && media.querySelector('img');
    if (!titleEl || !media || !image) return;

    var title = titleEl.textContent.trim();
    var raw = media.getAttribute('data-images');
    var images;
    try { images = raw ? JSON.parse(raw) : null; } catch (error) { images = null; }
    if (!images || images.length < 2) return;

    card.setAttribute('data-series-ready', 'true');
    media.classList.add('work__media--series');
    media.setAttribute('data-series-images', JSON.stringify(images));
    media.setAttribute('data-series-title', title);
    media.setAttribute('data-series-index', '0');
    media.setAttribute('aria-label', title + ' image series');

    var controls = document.createElement('div');
    controls.className = 'work__series-controls';
    controls.innerHTML =
      '<button class="work__series-nav work__series-nav--prev" type="button" data-series-step="-1" aria-label="Previous image in ' + title + ' series">&#8249;</button>' +
      '<div class="work__series-dots" aria-hidden="true">' +
        images.map(function (_, index) {
          return '<span class="work__series-dot' + (index === 0 ? ' is-active' : '') + '" data-series-slide="' + index + '"></span>';
        }).join('') +
      '</div>' +
      '<button class="work__series-nav work__series-nav--next" type="button" data-series-step="1" aria-label="Next image in ' + title + ' series">&#8250;</button>';
    media.appendChild(controls);
    showSlide(media, 0);
  }

  function enhanceAll() {
    var cards = grid.querySelectorAll('.work');
    for (var i = 0; i < cards.length; i++) enhanceCard(cards[i]);
  }

  grid.addEventListener('click', function (event) {
    var button = event.target.closest('[data-series-step]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    var media = button.closest('.work__media--series');
    var current = Number(media.getAttribute('data-series-index')) || 0;
    showSlide(media, current + Number(button.getAttribute('data-series-step')));
  });

  enhanceAll();

  if ('MutationObserver' in window) {
    new MutationObserver(enhanceAll).observe(grid, { childList: true });
  }
}());

/* Collection: full-size image lightbox */
(function () {
  var grid = document.querySelector('.collection-grid');
  if (!grid) return;

  var lightbox, imageEl, titleEl, metaEl, fullLink, prevBtn, nextBtn, stage;
  var items = [];
  var index = 0;
  var lastFocused;

  function getVisibleCards() {
    var out = [];
    var cards = grid.querySelectorAll('.work');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].style.display === 'none') continue;
      out.push(cards[i]);
    }
    return out;
  }

  function readCard(card) {
    var img = card.querySelector('.work__media img');
    var title = card.querySelector('.work__title');
    var year = card.querySelector('.work__year');
    var edition = card.querySelector('.work__meta p');
    return {
      src: img ? (img.getAttribute('data-full-src') || img.getAttribute('src')) : '',
      alt: img ? (img.getAttribute('alt') || '') : '',
      title: title ? title.textContent.trim() : '',
      year: year ? year.textContent.trim() : '',
      edition: edition ? edition.textContent.trim() : ''
    };
  }

  function createLightbox() {
    var wrapper = document.createElement('div');
    wrapper.className = 'lightbox';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = '' +
      '<div class="lightbox__backdrop" data-lightbox-close></div>' +
      '<div class="lightbox__stage" role="dialog" aria-modal="true" aria-label="Artwork preview" tabindex="-1">' +
        '<button class="lightbox__close" type="button" aria-label="Close preview" data-lightbox-close>&times;</button>' +
        '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Previous work" data-lightbox-prev>&#8249;</button>' +
        '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Next work" data-lightbox-next>&#8250;</button>' +
        '<figure class="lightbox__figure">' +
          '<img class="lightbox__image" alt="">' +
          '<figcaption class="lightbox__caption">' +
            '<span class="lightbox__title"></span>' +
            '<span class="lightbox__meta"></span>' +
            '<a class="lightbox__full" target="_blank" rel="noopener">Open full size &#8599;</a>' +
          '</figcaption>' +
        '</figure>' +
      '</div>';
    document.body.appendChild(wrapper);

    lightbox = wrapper;
    stage = wrapper.querySelector('.lightbox__stage');
    imageEl = wrapper.querySelector('.lightbox__image');
    titleEl = wrapper.querySelector('.lightbox__title');
    metaEl = wrapper.querySelector('.lightbox__meta');
    fullLink = wrapper.querySelector('.lightbox__full');
    prevBtn = wrapper.querySelector('[data-lightbox-prev]');
    nextBtn = wrapper.querySelector('[data-lightbox-next]');

    var closers = wrapper.querySelectorAll('[data-lightbox-close]');
    for (var i = 0; i < closers.length; i++) {
      closers[i].addEventListener('click', close);
    }
    wrapper.addEventListener('click', function (e) {
      if (e.target === wrapper || (e.target && e.target.hasAttribute('data-lightbox-close'))) {
        close();
      }
    });
    prevBtn.addEventListener('click', function () { step(-1); });
    nextBtn.addEventListener('click', function () { step(1); });

    imageEl.addEventListener('load', function () {
      imageEl.classList.add('is-loaded');
    });

    wrapper.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { step(-1); return; }
      if (e.key === 'ArrowRight') { step(1); return; }
      if (e.key !== 'Tab') return;
      var focusable = stage.querySelectorAll('a[href], button:not([hidden])');
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

  function render() {
    var data = items[index];
    if (!data) return;
    imageEl.classList.remove('is-loaded');
    imageEl.src = data.src;
    imageEl.alt = data.alt;
    titleEl.textContent = data.title;
    metaEl.textContent = [data.year, data.edition].filter(Boolean).join('  ·  ');
    fullLink.href = data.src;

    var multiple = items.length > 1;
    prevBtn.hidden = !multiple;
    nextBtn.hidden = !multiple;
  }

  function step(delta) {
    if (!items.length) return;
    index = (index + delta + items.length) % items.length;
    render();
  }

  function openItems(nextItems, startIndex) {
    if (!lightbox) createLightbox();
    items = nextItems;
    index = startIndex;
    lastFocused = document.activeElement;
    render();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    setTimeout(function () { stage.focus(); }, 0);
  }

  function open(cards, startIndex) {
    var nextItems = [];
    for (var i = 0; i < cards.length; i++) nextItems.push(readCard(cards[i]));
    openItems(nextItems, startIndex);
  }

  function openSeries(card, media) {
    var paths;
    try {
      paths = JSON.parse(media.getAttribute('data-series-images'));
    } catch (error) {
      paths = [];
    }
    if (!paths.length) return false;

    var cardData = readCard(card);
    var seriesItems = paths.map(function (path, seriesIndex) {
      return {
        src: path,
        alt: cardData.title + ' — image ' + (seriesIndex + 1) + ' of ' + paths.length,
        title: cardData.title,
        year: cardData.year,
        edition: cardData.edition
      };
    });
    var current = Number(media.getAttribute('data-series-index')) || 0;
    openItems(seriesItems, current);
    return true;
  }
  function close() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  grid.addEventListener('click', function (e) {
    var media = e.target.closest('.work__media');
    if (!media) return;
    var card = media.closest('.work');
    if (!card) return;
    if (media.classList.contains('work__media--series') && openSeries(card, media)) {
      return;
    }
    var visible = getVisibleCards();
    var startIndex = visible.indexOf(card);
    if (startIndex < 0) return;
    open(visible, startIndex);
  });

  window.lgndryLightbox = { open: open, close: close };
}());


/* ─── Hero: cinematic scroll sequence ────────────── */
(function () {
  var wrapper = document.querySelector('[data-hero-scroll]');
  if (!wrapper) { return; }

  var heroText = wrapper.querySelector('.hero__text');
  var heroShortCopy = wrapper.querySelector('.hero__short-copy-group');
  var heroImage = wrapper.querySelector('.hero__image');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reduced motion: the CSS fallback removes the runway; nothing to scrub.
  if (prefersReducedMotion || !heroImage) { return; }

  var ticking = false;
  var lastFade = -1;
  var lastScale = '';
  var lastBlur = '';

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function smooth(t) {
    return t * t * (3 - (2 * t));
  }

  function update() {
    ticking = false;

    var runway = wrapper.offsetHeight - window.innerHeight;
    if (runway <= 0) { return; }
    var progress = clamp(-wrapper.getBoundingClientRect().top / runway, 0, 1);

    // Phase 1 — content exit: fade + drift upward over the first quarter.
    var fade = smooth(clamp(progress / 0.25, 0, 1));

    // Phase 2 — slow zoom: begins as the text departs, runs to the end.
    var zoom = smooth(clamp((progress - 0.2) / 0.8, 0, 1));
    var scale = 1 + (zoom * 0.22);

    // Phase 3 — cinematic blur: builds through the final stretch of the zoom.
    var blur = smooth(clamp((progress - 0.55) / 0.45, 0, 1)) * 12;

    if (heroText && fade !== lastFade) {
      heroText.style.opacity = (1 - fade).toFixed(3);
      heroText.style.transform = 'translate3d(0, ' + (-fade * 64).toFixed(1) + 'px, 0)';
      heroText.style.pointerEvents = fade > 0.5 ? 'none' : '';
      if (heroShortCopy) {
        heroShortCopy.style.opacity = (1 - fade).toFixed(3);
        heroShortCopy.style.transform = 'translate3d(0, ' + (-fade * 64).toFixed(1) + 'px, 0)';
      }
      lastFade = fade;
    }

    var scaleValue = scale.toFixed(4);
    if (scaleValue !== lastScale) {
      heroImage.style.transform = 'scale(' + scaleValue + ')';
      lastScale = scaleValue;
    }

    // Quantise blur to quarter-pixel steps so we only re-rasterise when
    // the value meaningfully changes.
    var blurValue = (Math.round(blur * 4) / 4).toFixed(2);
    if (blurValue !== lastBlur) {
      heroImage.style.filter = parseFloat(blurValue) > 0 ? 'blur(' + blurValue + 'px)' : 'none';
      lastBlur = blurValue;
    }
  }

  function requestUpdate() {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(update);
  }

  update();
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
}());
