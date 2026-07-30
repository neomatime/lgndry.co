/* Shared custom date picker. Progressively enhances every
   input[type="date"] on the page (admin CMS fields, admin table filters,
   the public booking form) with a themed popup calendar, since the native
   browser calendar dropdown cannot be restyled with CSS. The original
   input is kept in the DOM (switched to type="hidden") so existing code
   that reads/writes its value or name keeps working unchanged. */
(function () {
  "use strict";

  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function toISO(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }

  function parseISO(value) {
    if (!value) return null;
    var parts = String(value).split("-");
    if (parts.length !== 3) return null;
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(date.getTime()) ? null : date;
  }

  function formatDisplay(date) {
    if (!date) return "";
    return MONTH_SHORT[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
  }

  var active = null;

  function closeActive() {
    if (!active) return;
    if (active.popup.parentNode) active.popup.parentNode.removeChild(active.popup);
    active = null;
  }

  document.addEventListener("mousedown", function (event) {
    if (active && !active.justOpened && !active.popup.contains(event.target) && !active.wrap.contains(event.target)) closeActive();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && active) closeActive();
  });

  window.addEventListener("resize", function () {
    if (active && !active.justOpened) closeActive();
  });
  window.addEventListener("scroll", function () {
    if (active && !active.justOpened) closeActive();
  }, true);

  function buildCells(viewDate, selectedIso) {
    var year = viewDate.getFullYear();
    var month = viewDate.getMonth();
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var daysInPrevMonth = new Date(year, month, 0).getDate();
    var todayIso = toISO(new Date());
    var cells = [];
    var i, day;

    for (i = 0; i < firstDay; i++) {
      cells.push({ label: daysInPrevMonth - firstDay + i + 1, muted: true });
    }
    for (day = 1; day <= daysInMonth; day++) {
      var iso = year + "-" + pad(month + 1) + "-" + pad(day);
      cells.push({ label: day, muted: false, iso: iso, isToday: iso === todayIso, isSelected: iso === selectedIso });
    }
    var remainder = cells.length % 7;
    var trailing = remainder === 0 ? 0 : 7 - remainder;
    for (i = 1; i <= trailing; i++) {
      cells.push({ label: i, muted: true });
    }
    return cells;
  }

  function renderPopupHtml(viewDate, selectedIso) {
    var cellsHtml = buildCells(viewDate, selectedIso).map(function (cell) {
      if (cell.muted) return '<span class="datepicker-cell datepicker-cell--muted">' + cell.label + "</span>";
      var classes = "datepicker-cell";
      if (cell.isToday) classes += " datepicker-cell--today";
      if (cell.isSelected) classes += " datepicker-cell--selected";
      return '<button type="button" class="' + classes + '" data-datepicker-day="' + cell.iso + '">' + cell.label + "</button>";
    }).join("");

    return (
      '<div class="datepicker-header">' +
        '<span class="datepicker-nav"><button type="button" class="datepicker-nav-btn" data-datepicker-prev aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button></span>' +
        '<span class="datepicker-title">' + MONTH_NAMES[viewDate.getMonth()] + " " + viewDate.getFullYear() + "</span>" +
        '<span class="datepicker-nav"><button type="button" class="datepicker-nav-btn" data-datepicker-next aria-label="Next month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button></span>' +
      "</div>" +
      '<div class="datepicker-weekdays">' + WEEKDAYS.map(function (w) { return "<span>" + w + "</span>"; }).join("") + "</div>" +
      '<div class="datepicker-grid">' + cellsHtml + "</div>" +
      '<div class="datepicker-footer">' +
        '<button type="button" class="datepicker-link" data-datepicker-clear">Clear</button>' +
        '<button type="button" class="datepicker-link" data-datepicker-today">Today</button>' +
      "</div>"
    );
  }

  function positionPopup(popup, wrap) {
    var rect = wrap.getBoundingClientRect();
    var popupWidth = popup.offsetWidth || 296;
    var left = window.scrollX + rect.left;
    var maxLeft = window.scrollX + document.documentElement.clientWidth - popupWidth - 12;
    if (left > maxLeft) left = Math.max(window.scrollX + 12, maxLeft);
    popup.style.top = (window.scrollY + rect.bottom + 6) + "px";
    popup.style.left = left + "px";
  }

  function openPopup(wrap, hiddenInput, displayInput) {
    if (active && active.wrap === wrap) { closeActive(); return; }
    closeActive();

    var selected = parseISO(hiddenInput.value);
    var viewDate = selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    var popup = document.createElement("div");
    popup.className = "datepicker-popup";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "Choose date");

    function paint() {
      popup.innerHTML = renderPopupHtml(viewDate, hiddenInput.value || "");
    }
    function setValue(iso) {
      hiddenInput.value = iso;
      displayInput.value = iso ? formatDisplay(parseISO(iso)) : "";
      var evt = document.createEvent("HTMLEvents");
      evt.initEvent("change", true, true);
      hiddenInput.dispatchEvent(evt);
    }

    paint();
    document.body.appendChild(popup);
    positionPopup(popup, wrap);
    active = { popup: popup, wrap: wrap, justOpened: true };
    setTimeout(function () { if (active) active.justOpened = false; }, 0);

    popup.addEventListener("click", function (event) {
      var dayBtn = event.target.closest("[data-datepicker-day]");
      if (dayBtn) {
        setValue(dayBtn.getAttribute("data-datepicker-day"));
        closeActive();
        return;
      }
      if (event.target.closest("[data-datepicker-prev]")) {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        paint();
        return;
      }
      if (event.target.closest("[data-datepicker-next]")) {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        paint();
        return;
      }
      if (event.target.closest("[data-datepicker-clear]")) {
        setValue("");
        closeActive();
        return;
      }
      if (event.target.closest("[data-datepicker-today]")) {
        var todayDate = new Date();
        viewDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
        setValue(toISO(todayDate));
        closeActive();
        return;
      }
    });
  }

  function enhance(input) {
    if (!input || input.getAttribute("data-datepicker-enhanced")) return;
    input.setAttribute("data-datepicker-enhanced", "true");

    var wrap = document.createElement("span");
    wrap.className = "datepicker-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.type = "hidden";

    var display = document.createElement("input");
    display.type = "text";
    display.className = "datepicker-display";
    display.readOnly = true;
    display.placeholder = input.getAttribute("placeholder") || "Select date";
    display.value = formatDisplay(parseISO(input.value));
    wrap.appendChild(display);

    var icon = document.createElement("span");
    icon.className = "datepicker-icon";
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
    wrap.appendChild(icon);

    wrap.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });

    wrap.addEventListener("click", function (event) {
      event.preventDefault();
      openPopup(wrap, input, display);
    });

    input.addEventListener("datepicker-sync", function () {
      display.value = formatDisplay(parseISO(input.value));
    });
  }

  function scan(root) {
    (root || document).querySelectorAll('input[type="date"]:not([data-datepicker-enhanced])').forEach(enhance);
  }

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('input[type="date"]')) enhance(node);
        if (node.querySelectorAll) scan(node);
      });
    });
  });

  function start() {
    scan(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
