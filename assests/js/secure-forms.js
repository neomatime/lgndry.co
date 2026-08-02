(function () {
  "use strict";

  var PRODUCTION_ORIGIN = "https://www.lgndry-co.co.za";
  var localHosts = ["localhost", "127.0.0.1", "[::1]"];

  if (window.location.protocol === "http:" && localHosts.indexOf(window.location.hostname) === -1) {
    window.location.replace("https://" + window.location.host + window.location.pathname + window.location.search + window.location.hash);
    return;
  }

  function secureAction(form) {
    if (!(form instanceof HTMLFormElement)) return;

    var declaredAction = form.getAttribute("action");
    var action;
    try {
      action = declaredAction ? new URL(declaredAction, window.location.href) : null;
    } catch (error) {
      action = null;
    }

    if (!action || action.protocol !== "https:") {
      var path = form.getAttribute("data-secure-action") || window.location.pathname || "/";
      form.setAttribute("action", PRODUCTION_ORIGIN + path);
    }

    form.setAttribute("method", "post");
    if (!form.hasAttribute("autocomplete")) form.setAttribute("autocomplete", "on");
  }

  function secureForms(root) {
    if (root instanceof HTMLFormElement) secureAction(root);
    if (root.querySelectorAll) root.querySelectorAll("form").forEach(secureAction);
  }

  secureForms(document);
  document.addEventListener("DOMContentLoaded", function () { secureForms(document); });

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) secureForms(node);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
