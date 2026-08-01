(function () {
  'use strict';

  var header = document.querySelector('.page-header');
  if (!header) return;

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
}());
