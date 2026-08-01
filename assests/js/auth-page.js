(function () {
  "use strict";
  if (!window.LgndryAuth) return;
  var client = window.LgndryAuth.client;
  var params = new URLSearchParams(location.search);
  var mode = params.get("mode") || "login";
  var allowed = ["login", "signup", "forgot", "reset", "verify"];
  if (allowed.indexOf(mode) < 0) mode = "login";

  function show(view) { document.querySelectorAll("[data-auth-view]").forEach(function (el) { el.classList.toggle("auth-hidden", el.dataset.authView !== view); }); }
  function feedback(selector, message, success) { var el = document.querySelector(selector); if (!el) return; el.textContent = message || ""; el.classList.toggle("auth-feedback--success", !!success); }
  function setBusy(form, busy) { var button = form.querySelector("button[type=submit]"); button.disabled = busy; button.dataset.label = button.dataset.label || button.textContent; button.textContent = busy ? "Please wait..." : button.dataset.label; }
  function destination() { var next = params.get("next"); return next && next.charAt(0) === "/" ? next : "account.html#orders"; }

  show(mode);
  var verifyEmail = document.querySelector("[data-verify-email]"); if (verifyEmail && params.get("email")) verifyEmail.textContent = params.get("email");

  var login = document.querySelector("[data-login-form]");
  login.addEventListener("submit", function (event) { event.preventDefault(); setBusy(login, true); feedback("[data-login-feedback]", ""); client.auth.signInWithPassword({ email: login.elements.email.value.trim(), password: login.elements.password.value }).then(function (result) { if (result.error) throw result.error; if (!result.data.user.email_confirmed_at) throw new Error("Please verify your email before logging in."); location.replace(destination()); }).catch(function (error) { feedback("[data-login-feedback]", error.message); setBusy(login, false); }); });

  var signup = document.querySelector("[data-signup-form]");
  signup.addEventListener("submit", function (event) { event.preventDefault(); if (signup.elements.password.value !== signup.elements.confirm_password.value) { feedback("[data-signup-feedback]", "Passwords do not match."); return; } setBusy(signup, true); feedback("[data-signup-feedback]", ""); client.auth.signUp({ email: signup.elements.email.value.trim(), password: signup.elements.password.value, options: { data: { full_name: signup.elements.full_name.value.trim() }, emailRedirectTo: location.origin + location.pathname.replace(/auth\.html$/, "account.html#orders") } }).then(function (result) { if (result.error) throw result.error; if (result.data.session) location.replace("account.html#orders"); else location.replace("auth.html?mode=verify&email=" + encodeURIComponent(signup.elements.email.value.trim())); }).catch(function (error) { feedback("[data-signup-feedback]", error.message); setBusy(signup, false); }); });

  var forgot = document.querySelector("[data-forgot-form]");
  forgot.addEventListener("submit", function (event) { event.preventDefault(); setBusy(forgot, true); client.auth.resetPasswordForEmail(forgot.elements.email.value.trim(), { redirectTo: location.origin + location.pathname + "?mode=reset" }).then(function (result) { if (result.error) throw result.error; feedback("[data-forgot-feedback]", "Reset link sent. Please check your inbox.", true); forgot.reset(); setBusy(forgot, false); }).catch(function (error) { feedback("[data-forgot-feedback]", error.message); setBusy(forgot, false); }); });

  var reset = document.querySelector("[data-reset-form]");
  reset.addEventListener("submit", function (event) { event.preventDefault(); if (reset.elements.password.value !== reset.elements.confirm_password.value) { feedback("[data-reset-feedback]", "Passwords do not match."); return; } setBusy(reset, true); client.auth.updateUser({ password: reset.elements.password.value }).then(function (result) { if (result.error) throw result.error; feedback("[data-reset-feedback]", "Password updated. Redirecting to your account...", true); setTimeout(function () { location.replace("account.html#settings"); }, 900); }).catch(function (error) { feedback("[data-reset-feedback]", error.message); setBusy(reset, false); }); });

  client.auth.onAuthStateChange(function (event) { if (event === "PASSWORD_RECOVERY") { mode = "reset"; show("reset"); } });
  window.LgndryAuth.getSession().then(function (session) { if (session && mode === "login") location.replace(destination()); });
}());
