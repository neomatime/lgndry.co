(function () {
  "use strict";
  if (!window.LgndryAuth) return;
  var client = window.LgndryAuth.client;
  var params = new URLSearchParams(location.search);
  var hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  var title = document.querySelector("[data-callback-title]");
  var eyebrow = document.querySelector("[data-callback-eyebrow]");
  var message = document.querySelector("[data-callback-message]");
  var error = document.querySelector("[data-callback-error]");
  var actions = document.querySelector("[data-callback-actions]");
  var primary = document.querySelector("[data-callback-primary]");

  function fail(text) {
    eyebrow.textContent = "Verification link issue";
    title.textContent = "We could not verify this link.";
    message.textContent = "The link may have expired or already been used. Request a fresh verification email and use only the newest link.";
    error.textContent = text || "Verification failed.";
    actions.classList.remove("auth-hidden");
    primary.textContent = "Request New Link";
    primary.href = "auth.html?mode=verify";
  }
  function success() {
    eyebrow.textContent = "Email confirmed";
    title.textContent = "Your account is verified.";
    message.textContent = "Thank you. Your LGNDRY.Co customer account is ready, and matching orders can now be securely connected to you.";
    error.textContent = "";
    actions.classList.remove("auth-hidden");
    if (params.get("next") === "reset") {
      primary.textContent = "Choose New Password";
      primary.href = "auth.html?mode=reset";
    }
  }

  var returnedError = params.get("error_description") || hash.get("error_description");
  if (returnedError) { fail(returnedError.replace(/\+/g, " ")); return; }

  var code = params.get("code");
  var tokenHash = params.get("token_hash");
  var operation;
  if (code) operation = client.auth.exchangeCodeForSession(code);
  else if (tokenHash) operation = client.auth.verifyOtp({ token_hash: tokenHash, type: params.get("type") || "email" });
  else operation = client.auth.getSession().then(function (result) { if (!result.data.session) throw new Error("No verification credentials were found in this link."); return result; });

  operation.then(function (result) { if (result.error) throw result.error; success(); }).catch(function (reason) { fail(reason.message); });
}());
