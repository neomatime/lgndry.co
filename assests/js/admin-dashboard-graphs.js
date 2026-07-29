(function () {
  "use strict";

  function injectStyles() {
    if (document.querySelector("[data-dashboard-graphs-styles]")) return;

    var style = document.createElement("style");
    style.setAttribute("data-dashboard-graphs-styles", "");
    style.textContent = [
      ".ops-app-shell .dashboard-graphs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}",
      ".ops-app-shell .graph-panel{min-height:220px;border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);padding:22px;display:grid;align-content:space-between}",
      ".ops-app-shell .graph-panel__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}",
      ".ops-app-shell .graph-panel__value{font-family:\"Cormorant Garamond\",Georgia,serif;font-size:3rem;line-height:.9}",
      ".ops-app-shell .graph-bars{display:grid;gap:13px}",
      ".ops-app-shell .graph-bar{display:grid;grid-template-columns:92px 1fr 44px;gap:12px;align-items:center;color:var(--muted);font-size:.78rem}",
      ".ops-app-shell .graph-bar__track{height:3px;background:var(--line);overflow:hidden}",
      ".ops-app-shell .graph-bar__track span{display:block;height:100%;background:var(--text)}",
      ".ops-app-shell .graph-line{height:72px;display:flex;align-items:flex-end;gap:8px;margin-top:8px}",
      ".ops-app-shell .graph-line span{flex:1;min-height:8px;background:linear-gradient(180deg,var(--text),var(--line));border-radius:999px 999px 0 0}",
      "@media (max-width:1200px){.ops-app-shell .dashboard-graphs{grid-template-columns:1fr}}"
    ].join("");
    document.head.appendChild(style);
  }

  function numberFromText(text) {
    var clean = String(text || "").replace(/[^\d.-]/g, "");
    return Number(clean || 0);
  }

  function metrics() {
    var values = {};
    document.querySelectorAll(".dashboard-metrics .metric").forEach(function (metric) {
      var label = (metric.querySelector(".metric__label") || {}).textContent || "";
      var value = (metric.querySelector(".metric__value") || {}).textContent || "";
      values[label.trim()] = value.trim();
    });
    return values;
  }

  function bar(label, value, max) {
    var width = max ? Math.max(6, Math.min(100, Math.round((value / max) * 100))) : 6;
    return '<div class="graph-bar"><span>' + label + '</span><div class="graph-bar__track"><span style="width:' + width + '%"></span></div><strong>' + value + "</strong></div>";
  }

  function weeklyActivityBuckets() {
    var snapshot = window.LgndryOpsSnapshot ? window.LgndryOpsSnapshot() : null;
    var activity = (snapshot && snapshot.activity) || [];
    var buckets = [0, 0, 0, 0, 0, 0];
    var now = Date.now();
    var weekMs = 7 * 24 * 60 * 60 * 1000;
    activity.forEach(function (entry) {
      var t = new Date(entry.at).getTime();
      if (isNaN(t)) return;
      var index = Math.floor((now - t) / weekMs);
      if (index >= 0 && index < 6) buckets[5 - index]++;
    });
    return buckets;
  }

  function momentumMarkup() {
    var buckets = weeklyActivityBuckets();
    var total = buckets.reduce(function (sum, count) { return sum + count; }, 0);
    if (!total) return { total: 0, markup: '<p class="empty-state">No activity yet.</p>' };
    var max = Math.max.apply(null, buckets);
    var bars = buckets.map(function (count) {
      var height = Math.max(8, Math.round((count / max) * 100));
      return '<span style="height:' + height + '%"></span>';
    }).join("");
    return { total: total, markup: '<div class="graph-line">' + bars + "</div>" };
  }

  function graphMarkup() {
    var current = metrics();
    var activeProjects = numberFromText(current["Active Projects"]);
    var upcomingBookings = numberFromText(current["Upcoming Bookings"]);
    var outstandingInvoices = numberFromText(current["Outstanding Invoices"]);
    var collectionSales = numberFromText(current["Collection Sales"]);
    var pipeline = numberFromText(current["Partnership Pipeline"]);
    var revenueMax = Math.max(outstandingInvoices, collectionSales, 1);
    var opsMax = Math.max(activeProjects, upcomingBookings, pipeline, 1);
    var momentum = momentumMarkup();

    return '<section class="dashboard-graphs" aria-label="Command center graphs">' +
      '<article class="graph-panel"><div><div class="graph-panel__head"><span class="panel__label">Revenue Pulse</span><strong class="graph-panel__value">' + (current["Collection Sales"] || "R0") + '</strong></div><div class="graph-bars">' + bar("Sales", collectionSales, revenueMax) + bar("Open", outstandingInvoices, revenueMax) + '</div></div></article>' +
      '<article class="graph-panel"><div><div class="graph-panel__head"><span class="panel__label">Operations Load</span><strong class="graph-panel__value">' + (activeProjects + upcomingBookings + pipeline) + '</strong></div><div class="graph-bars">' + bar("Projects", activeProjects, opsMax) + bar("Bookings", upcomingBookings, opsMax) + bar("Pipeline", pipeline, opsMax) + '</div></div></article>' +
      '<article class="graph-panel"><div><div class="graph-panel__head"><span class="panel__label">Studio Momentum</span><strong class="graph-panel__value">' + momentum.total + '</strong></div>' + momentum.markup + "</div></article>" +
      "</section>";
  }

  function replaceHero() {
    var hero = document.querySelector(".hero-strip");
    if (!hero) return;
    var wrapper = document.createElement("div");
    wrapper.innerHTML = graphMarkup();
    hero.replaceWith(wrapper.firstElementChild);
  }

  function init() {
    injectStyles();
    replaceHero();
    var view = document.querySelector("[data-view]");
    if (!view) return;
    new MutationObserver(replaceHero).observe(view, { childList: true, subtree: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
