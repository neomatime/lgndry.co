(function () {
  "use strict";

  var STORAGE_KEY = "lgndry_admin_sidebar_collapsed";

  function injectStyles() {
    if (document.querySelector("[data-sidebar-collapse-styles]")) return;

    var style = document.createElement("style");
    style.setAttribute("data-sidebar-collapse-styles", "");
    style.textContent = [
      ".ops-app-shell .sidebar-toggle{width:40px;height:40px;margin:0 0 24px 10px;border:1px solid var(--line);border-radius:var(--radius);background:transparent;color:var(--text);display:grid;place-items:center;transition:background .2s ease,color .2s ease}",
      ".ops-app-shell .sidebar-toggle:hover{background:var(--panel-soft)}",
      ".ops-app-shell .sidebar-toggle svg{width:18px;height:18px;stroke-width:1.5;transition:transform .2s ease}",
      ".ops-app-shell .ops-shell{transition:grid-template-columns .24s ease}",
      ".ops-app-shell .ops-sidebar{transition:padding .24s ease}",
      "@media (min-width:981px){",
      ".ops-app-shell.sidebar-collapsed .ops-shell{grid-template-columns:88px minmax(0,1fr)}",
      ".ops-app-shell.sidebar-collapsed .ops-sidebar{padding:36px 18px 24px}",
      ".ops-app-shell.sidebar-collapsed .brand__name,.ops-app-shell.sidebar-collapsed .brand__label,.ops-app-shell.sidebar-collapsed .nav-item span,.ops-app-shell.sidebar-collapsed .sidebar-card{display:none}",
      ".ops-app-shell.sidebar-collapsed .brand{padding:0 0 28px}",
      ".ops-app-shell.sidebar-collapsed .side-nav{padding:4px 0;gap:22px;justify-items:center}",
      ".ops-app-shell.sidebar-collapsed .nav-item{grid-template-columns:1fr;width:40px;height:40px;place-items:center}",
      ".ops-app-shell.sidebar-collapsed .nav-item svg{width:20px;height:20px}",
      ".ops-app-shell.sidebar-collapsed .nav-item--active{text-decoration:none}",
      ".ops-app-shell.sidebar-collapsed .sidebar-toggle{margin-left:0}",
      ".ops-app-shell.sidebar-collapsed .sidebar-toggle svg{transform:rotate(180deg)}",
      "}",
      "@media (max-width:980px){.ops-app-shell .sidebar-toggle{display:none}}"
    ].join("");

    document.head.appendChild(style);
  }

  function setCollapsed(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");

    var toggle = document.querySelector("[data-sidebar-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      toggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    }
  }

  function initSidebarCollapse() {
    var sidebar = document.querySelector(".ops-sidebar");
    var brand = document.querySelector(".ops-sidebar .brand");
    if (!sidebar || !brand || document.querySelector("[data-sidebar-toggle]")) return;

    injectStyles();

    var button = document.createElement("button");
    button.type = "button";
    button.className = "sidebar-toggle";
    button.setAttribute("data-sidebar-toggle", "");
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 18l-6-6 6-6"/></svg>';
    button.addEventListener("click", function () {
      setCollapsed(!document.body.classList.contains("sidebar-collapsed"));
    });

    sidebar.insertBefore(button, brand.nextSibling);
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebarCollapse);
  } else {
    initSidebarCollapse();
  }
}());
