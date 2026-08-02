(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var main = document.querySelector('main');
  if (main) {
    if (!main.id) main.id = 'main-content';
    if (!document.querySelector('.skip-link')) {
      var skipLink = document.createElement('a');
      skipLink.className = 'skip-link';
      skipLink.href = '#' + main.id;
      skipLink.textContent = 'Skip to content';
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
  }

  var currentPath = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-panel__item[href], .site-footer a[href]').forEach(function (link) {
    var href = (link.getAttribute('href') || '').split('#')[0].split('?')[0].toLowerCase();
    if (href && !href.includes('://') && href === currentPath) link.setAttribute('aria-current', 'page');
  });

  document.querySelectorAll('[data-auth-feedback], [data-checkout-feedback], [data-showroom-feedback], .auth-feedback, .checkout-feedback, .showroom-feedback, [data-catalogue-results]').forEach(function (element) {
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
  });

  document.querySelectorAll('a[target="_blank"]').forEach(function (link) {
    var rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel', Array.from(rel).join(' '));
  });

  var header = document.querySelector('.page-header');
  if (header) {
    var ticking = false;
    function updateHeader() {
      ticking = false;
      header.classList.toggle('page-header--scrolled', window.scrollY > 24);
    }
    function requestHeaderUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateHeader);
    }
    updateHeader();
    window.addEventListener('scroll', requestHeaderUpdate, { passive: true });
  }
}());
