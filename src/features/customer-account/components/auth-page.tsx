"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { authCallbackUrl, safeCustomerNext } from "@/features/customer-account/next-path";
import { replaceLocation } from "@/features/customer-account/navigate";
import { createSupabaseBrowserClient } from "@/lib/db/client";
import { cn } from "@/lib/utils/cn";

type Mode = "login" | "signup" | "forgot" | "reset" | "verify";
const MODES: Mode[] = ["login", "signup", "forgot", "reset", "verify"];

type Feedback = { text: string; success?: boolean };

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 0 1-2 3v2.8h3.3c1.9-1.8 2.9-4.4 2.9-7.9z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.8c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.8A10 10 0 0 0 12 22z"
    />
    <path fill="#FBBC05" d="M6.5 13.7a6 6 0 0 1 0-3.4V7.5H3.1a10 10 0 0 0 0 9l3.4-2.8z" />
    <path
      fill="#EA4335"
      d="M12 6.2c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.4 2.8A5.9 5.9 0 0 1 12 6.2z"
    />
  </svg>
);

/** The feedback line under a form: red for errors, green for success. Reads out politely. */
function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return (
    <p
      className={cn("auth-feedback", feedback.success && "auth-feedback--success")}
      role="status"
      aria-live="polite"
    >
      {feedback.text}
    </p>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  minLength,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
  minLength?: number;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        {...(onChange ? { value: value ?? "", onChange: (e) => onChange(e.target.value) } : {})}
      />
    </label>
  );
}

const value = (form: HTMLFormElement, name: string) =>
  (form.elements.namedItem(name) as HTMLInputElement).value;

/** Runs a form's async work with the button showing "Please wait..." meanwhile. */
function useBusy() {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (work: () => Promise<void>) => {
      setBusy(true);
      try {
        await work();
      } finally {
        setBusy(false);
      }
    },
  };
}

function SubmitButton({
  busy,
  children,
  light,
}: {
  busy: boolean;
  children: string;
  light?: boolean;
}) {
  return (
    <button
      className={cn("auth-button", light && "auth-button--light")}
      type="submit"
      disabled={busy}
    >
      {busy ? "Please wait..." : children}
    </button>
  );
}

export function AuthPage() {
  const params = useSearchParams();
  const requested = params.get("mode") as Mode | null;
  const [recovery, setRecovery] = useState(false);
  const mode: Mode = recovery
    ? "reset"
    : requested && MODES.includes(requested)
      ? requested
      : "login";
  const email = params.get("email") ?? "";
  const destination = safeCustomerNext(params.get("next"));

  const client = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null; // not configured
    }
  }, []);
  const callback = () => authCallbackUrl(window.location.origin);
  const NOT_CONFIGURED: Feedback = {
    text: "Sign-in is not available right now. Please try again later.",
  };

  const [googleBusy, setGoogleBusy] = useState(false);
  const [login, setLogin] = useState<Feedback>({ text: "" });
  const [signup, setSignup] = useState<Feedback>({ text: "" });
  const [forgot, setForgot] = useState<Feedback>({ text: "" });
  const [reset, setReset] = useState<Feedback>({ text: "" });
  const [resend, setResend] = useState<Feedback>({ text: "" });
  const [resendEmail, setResendEmail] = useState(email);
  const loginBusy = useBusy();
  const signupBusy = useBusy();
  const forgotBusy = useBusy();
  const resetBusy = useBusy();
  const resendBusy = useBusy();
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The recovery link signs the customer in and asks for a new password; someone already signed in is sent on.
  useEffect(() => {
    if (!client) return;
    let active = true;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    void client.auth.getSession().then(({ data: { session } }) => {
      if (active && session && mode === "login") replaceLocation(destination);
    });
    const timer = redirectTimer;
    return () => {
      active = false;
      data.subscription.unsubscribe();
      clearTimeout(timer.current);
    };
  }, [client, mode, destination]);

  const google = async (feedbackFor: (f: Feedback) => void) => {
    if (!client) return feedbackFor(NOT_CONFIGURED);
    setGoogleBusy(true);
    feedbackFor({ text: "Opening Google sign-in..." });
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(), queryParams: { prompt: "select_account" } },
    });
    if (error) {
      feedbackFor({ text: error.message });
      setGoogleBusy(false);
    }
  };

  const googleButton = (feedbackFor: (f: Feedback) => void) => (
    <>
      <button
        className="google-auth-button"
        type="button"
        disabled={googleBusy}
        onClick={() => void google(feedbackFor)}
      >
        {GOOGLE_ICON}
        <span>Continue with Google</span>
      </button>
      <div className="auth-divider">
        <span>or continue with email</span>
      </div>
    </>
  );

  const submitLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void loginBusy.run(async () => {
      setLogin({ text: "" });
      if (!client) return setLogin(NOT_CONFIGURED);
      const { data, error } = await client.auth.signInWithPassword({
        email: value(form, "email").trim(),
        password: value(form, "password"),
      });
      if (error) return setLogin({ text: error.message });
      if (!data.user?.email_confirmed_at) {
        await client.auth.signOut();
        return setLogin({ text: "Please verify your email before logging in." });
      }
      replaceLocation(destination);
    });
  };

  const submitSignup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (value(form, "password") !== value(form, "confirm_password")) {
      return setSignup({ text: "Passwords do not match." });
    }
    void signupBusy.run(async () => {
      setSignup({ text: "" });
      if (!client) return setSignup(NOT_CONFIGURED);
      const address = value(form, "email").trim();
      const { data, error } = await client.auth.signUp({
        email: address,
        password: value(form, "password"),
        options: {
          data: { full_name: value(form, "full_name").trim() },
          emailRedirectTo: callback(),
        },
      });
      if (error) return setSignup({ text: error.message });
      replaceLocation(
        data.session ? "/account#orders" : `/auth?mode=verify&email=${encodeURIComponent(address)}`,
      );
    });
  };

  const submitForgot = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void forgotBusy.run(async () => {
      if (!client) return setForgot(NOT_CONFIGURED);
      const { error } = await client.auth.resetPasswordForEmail(value(form, "email").trim(), {
        redirectTo: `${callback()}?next=reset`,
      });
      if (error) return setForgot({ text: error.message });
      setForgot({ text: "Reset link sent. Please check your inbox.", success: true });
      form.reset();
    });
  };

  const submitReset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (value(form, "password") !== value(form, "confirm_password")) {
      return setReset({ text: "Passwords do not match." });
    }
    void resetBusy.run(async () => {
      if (!client) return setReset(NOT_CONFIGURED);
      const { error } = await client.auth.updateUser({ password: value(form, "password") });
      if (error) return setReset({ text: error.message });
      setReset({ text: "Password updated. Redirecting to your account...", success: true });
      redirectTimer.current = setTimeout(() => replaceLocation("/account#settings"), 900);
    });
  };

  const submitResend = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void resendBusy.run(async () => {
      setResend({ text: "" });
      if (!client) return setResend(NOT_CONFIGURED);
      const { error } = await client.auth.resend({
        type: "signup",
        email: resendEmail.trim(),
        options: { emailRedirectTo: callback() },
      });
      if (error) return setResend({ text: error.message });
      setResend({
        text: "A new verification email has been sent. Use only the newest link.",
        success: true,
      });
    });
  };

  return (
    <>
      <header className="account-topbar">
        <Link className="account-brand" href="/">
          LGNDRY.Co
        </Link>
        <Link className="account-topbar__link" href="/collection">
          Return to collection
        </Link>
      </header>
      <main className="auth-layout" id="main-content">
        <section className="auth-visual">
          <Image
            src="/assests/images/optimized/home-hero.webp"
            alt="LGNDRY.Co visual artwork"
            width={2400}
            height={1350}
            priority
          />
          <div className="auth-visual__copy">
            <span>Private client area</span>
            <h1>
              Your work,
              <br />
              in one place.
            </h1>
            <p>Review requests and follow each order from confirmation to completion.</p>
          </div>
        </section>
        <section className="auth-panel">
          {mode === "login" ? (
            <div className="auth-card">
              <span className="account-eyebrow">Welcome back</span>
              <h1>Log in.</h1>
              <p className="auth-card__intro">Access your orders and account details securely.</p>
              {googleButton(setLogin)}
              <form className="auth-form" autoComplete="on" onSubmit={submitLogin}>
                <Field label="Email address" name="email" type="email" autoComplete="email" />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                />
                <FeedbackLine feedback={login} />
                <SubmitButton busy={loginBusy.busy}>Log In</SubmitButton>
              </form>
              <div className="auth-links">
                <Link href="/auth?mode=forgot">Forgot password?</Link>
                <Link href="/auth?mode=signup">Create an account</Link>
              </div>
            </div>
          ) : null}

          {mode === "signup" ? (
            <div className="auth-card">
              <span className="account-eyebrow">Customer account</span>
              <h1>Create account.</h1>
              <p className="auth-card__intro">
                Your verified email securely connects existing and future orders to your account.
              </p>
              {googleButton(setSignup)}
              <form className="auth-form" autoComplete="on" onSubmit={submitSignup}>
                <Field label="Full name" name="full_name" autoComplete="name" />
                <Field label="Email address" name="email" type="email" autoComplete="email" />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                />
                <Field
                  label="Confirm password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                />
                <FeedbackLine feedback={signup} />
                <SubmitButton busy={signupBusy.busy}>Create Account</SubmitButton>
              </form>
              <div className="auth-links">
                <span>Already registered?</span>
                <Link href="/auth?mode=login">Log in</Link>
              </div>
            </div>
          ) : null}

          {mode === "forgot" ? (
            <div className="auth-card">
              <span className="account-eyebrow">Account recovery</span>
              <h1>Reset password.</h1>
              <p className="auth-card__intro">
                Enter your email and we will send you a secure password-reset link.
              </p>
              <form className="auth-form" autoComplete="on" onSubmit={submitForgot}>
                <Field label="Email address" name="email" type="email" autoComplete="email" />
                <FeedbackLine feedback={forgot} />
                <SubmitButton busy={forgotBusy.busy}>Send Reset Link</SubmitButton>
              </form>
              <div className="auth-links">
                <Link href="/auth?mode=login">Back to login</Link>
              </div>
            </div>
          ) : null}

          {mode === "reset" ? (
            <div className="auth-card">
              <span className="account-eyebrow">Choose a new password</span>
              <h1>Secure your account.</h1>
              <p className="auth-card__intro">
                Use at least eight characters for your new password.
              </p>
              <form className="auth-form" autoComplete="on" onSubmit={submitReset}>
                <Field
                  label="New password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                />
                <Field
                  label="Confirm password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                />
                <FeedbackLine feedback={reset} />
                <SubmitButton busy={resetBusy.busy}>Update Password</SubmitButton>
              </form>
            </div>
          ) : null}

          {mode === "verify" ? (
            <div className="auth-card">
              <span className="account-eyebrow">One final step</span>
              <h1>Verify your email.</h1>
              <p className="auth-card__intro">
                We sent a verification link to <strong>{email || "your email address"}</strong>.
                Open the newest email to activate your account and securely link matching orders.
              </p>
              <form className="auth-form" autoComplete="on" onSubmit={submitResend}>
                <Field
                  label="Email address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={resendEmail}
                  onChange={setResendEmail}
                />
                <FeedbackLine feedback={resend} />
                <SubmitButton busy={resendBusy.busy} light>
                  Resend Verification Email
                </SubmitButton>
              </form>
              <div className="auth-links">
                <Link href="/auth?mode=login">Return to Log In</Link>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
