(function () {
  "use strict";
  if (!window.supabase) return;

  var SUPABASE_URL = "https://tscaluhtfrvwlwjybfsg.supabase.co";
  var SUPABASE_KEY = "sb_publishable_UAS3aUpb9Aj7lbVBPkWncA_l4ghKr4w";
  var client = window.LgndryCustomerClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.LgndryCustomerClient = client;

  function getSession() { return client.auth.getSession().then(function (result) { return result.data.session; }); }
  function getUser() { return client.auth.getUser().then(function (result) { return result.data.user; }); }
  function requireSession() {
    return getSession().then(function (session) {
      if (!session) {
        var next = encodeURIComponent(location.pathname + location.hash);
        location.replace("auth.html?mode=login&next=" + next);
        return null;
      }
      return session;
    });
  }
  function signOut() { return client.auth.signOut().then(function () { location.replace("index.html"); }); }

  window.LgndryAuth = { client: client, getSession: getSession, getUser: getUser, requireSession: requireSession, signOut: signOut };

  function renderNav(session) {
    document.querySelectorAll(".nav-panel__list").forEach(function (list) {
      var existing = list.querySelector("[data-customer-nav]");
      if (existing) existing.remove();
      var item = document.createElement("li");
      item.setAttribute("data-customer-nav", "");
      if (session) {
        item.innerHTML = '<a class="nav-panel__item nav-panel__item--account" href="account.html#orders">My Account</a>';
      } else {
        item.innerHTML = '<div class="nav-panel__account-links"><a href="auth.html?mode=login">Log In</a><span></span><a href="auth.html?mode=signup">Create Account</a></div>';
      }
      list.appendChild(item);
    });
  }

  client.auth.onAuthStateChange(function (_event, session) { renderNav(session); });
  getSession().then(renderNav);
}());
