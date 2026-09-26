"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/db/client";
import { cn } from "@/lib/utils/cn";

type Outcome =
  { status: "verifying" } | { status: "success" } | { status: "failed"; reason: string };

/**
 * Where the emailed links (verify email, reset password) and Google sign-in
 * land. Works out which kind of return this is, signs the customer in, and
 * says what happened.
 */
export function AuthCallback() {
  const params = useSearchParams();
  const [outcome, setOutcome] = useState<Outcome>({ status: "verifying" });
  // A sign-in code can be used once; make sure development double-mounting doesn't spend it twice.
  const started = useRef(false);
  const next = params.get("next");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let active = true;
    const finish = (result: Outcome) => {
      if (active) setOutcome(result);
    };

    void (async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const returnedError = params.get("error_description") || hash.get("error_description");
      if (returnedError)
        return finish({ status: "failed", reason: returnedError.replace(/\+/g, " ") });

      let client: ReturnType<typeof createSupabaseBrowserClient>;
      try {
        client = createSupabaseBrowserClient();
      } catch {
        return finish({ status: "failed", reason: "Verification failed." });
      }

      try {
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: (params.get("type") ?? "email") as "email",
          });
          if (error) throw error;
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          // Links sent by the legacy site carry the session in the address fragment.
          const { error } = await client.auth.setSession({
            access_token: hash.get("access_token")!,
            refresh_token: hash.get("refresh_token")!,
          });
          if (error) throw error;
        } else {
          const { data } = await client.auth.getSession();
          if (!data.session)
            throw new Error("No verification credentials were found in this link.");
        }
        finish({ status: "success" });
      } catch (reason) {
        finish({
          status: "failed",
          reason: reason instanceof Error ? reason.message : "Verification failed.",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [params]);

  const failed = outcome.status === "failed";
  const done = outcome.status !== "verifying";
  const primary = failed
    ? { label: "Request New Link", href: "/auth?mode=verify" }
    : next === "reset"
      ? { label: "Choose New Password", href: "/auth?mode=reset" }
      : { label: "Continue to My Account", href: "/account#orders" };

  return (
    <>
      <header className="account-topbar">
        <Link className="account-brand" href="/">
          LGNDRY.Co
        </Link>
        <Link className="account-topbar__link" href="/">
          Return home
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
            <span>Customer account</span>
            <h1>
              Almost
              <br />
              there.
            </h1>
            <p>Your private collection and order history are waiting.</p>
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <span className="account-eyebrow">
              {failed
                ? "Verification link issue"
                : done
                  ? "Email confirmed"
                  : "Secure verification"}
            </span>
            <h1>
              {failed
                ? "We could not verify this link."
                : done
                  ? "Your account is verified."
                  : "Verifying your email…"}
            </h1>
            <p className="auth-card__intro">
              {failed
                ? "The link may have expired or already been used. Request a fresh verification email and use only the newest link."
                : done
                  ? "Thank you. Your LGNDRY.Co customer account is ready, and matching orders can now be securely connected to you."
                  : "Please keep this page open while we confirm your LGNDRY.Co account."}
            </p>
            <div className="auth-feedback" role="status" aria-live="polite">
              {outcome.status === "failed" ? outcome.reason : ""}
            </div>
            <div className={cn("auth-links", !done && "auth-hidden")}>
              <Link className="auth-button" href={primary.href} style={{ textDecoration: "none" }}>
                {primary.label}
              </Link>
              <Link href="/auth?mode=login">Log In</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
