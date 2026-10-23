"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { signInAction, type SignInState } from "@/features/auth/actions/sign-in";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, {
    error: initialError,
  } satisfies SignInState);
  const [email, setEmail] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const emailDescription = [
    state.fieldErrors?.email ? "login-email-error" : null,
    state.error ? "login-error" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form action={formAction} className="flex flex-col" noValidate aria-busy={pending}>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? (
        <div
          id="login-error"
          role="alert"
          className="auth-feedback border-line-strong mb-5 flex items-start gap-3 border bg-white/65 px-4 py-3 text-sm leading-5 shadow-[0_8px_24px_rgb(33_29_24_/_4%)]"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <div
            className={`flex h-14 items-center gap-3 border bg-white/82 px-4 shadow-[0_8px_24px_rgb(44_37_29_/_7%)] transition-[border-color,box-shadow,transform] duration-200 focus-within:-translate-y-px focus-within:shadow-[0_12px_30px_rgb(44_37_29_/_10%)] ${state.fieldErrors?.email ? "border-ink" : "border-white/90"}`}
          >
            <Mail className="text-ink-muted size-[1.15rem] shrink-0" aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={state.fieldErrors?.email ? true : undefined}
              aria-describedby={emailDescription || undefined}
              placeholder="Email"
              className="placeholder:text-ink-muted/80 min-w-0 flex-1 bg-transparent text-[0.94rem] outline-none"
            />
          </div>
          {state.fieldErrors?.email ? (
            <p id="login-email-error" className="mt-2 text-xs" role="alert">
              Enter a valid email address.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <div
            className={`flex h-14 items-center gap-3 border bg-white/82 px-4 shadow-[0_8px_24px_rgb(44_37_29_/_7%)] transition-[border-color,box-shadow,transform] duration-200 focus-within:-translate-y-px focus-within:shadow-[0_12px_30px_rgb(44_37_29_/_10%)] ${state.fieldErrors?.password ? "border-ink" : "border-white/90"}`}
          >
            <LockKeyhole className="text-ink-muted size-[1.15rem] shrink-0" aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
              required
              aria-invalid={state.fieldErrors?.password ? true : undefined}
              aria-describedby={
                state.fieldErrors?.password ? "login-password-error login-error" : undefined
              }
              placeholder="Password"
              className="placeholder:text-ink-muted/80 min-w-0 flex-1 bg-transparent text-[0.94rem] outline-none"
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((visible) => !visible)}
              className="text-ink-muted hover:text-ink flex size-9 shrink-0 items-center justify-center transition-colors"
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              aria-pressed={passwordVisible}
            >
              {passwordVisible ? (
                <EyeOff className="size-[1.1rem]" aria-hidden="true" />
              ) : (
                <Eye className="size-[1.1rem]" aria-hidden="true" />
              )}
            </button>
          </div>
          {state.fieldErrors?.password ? (
            <p id="login-password-error" className="mt-2 text-xs" role="alert">
              {state.fieldErrors.password}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 text-sm">
        <label className="group flex cursor-pointer items-center gap-2.5">
          <span className="relative flex size-[1.15rem] shrink-0 items-center justify-center">
            <input
              type="checkbox"
              name="keepSignedIn"
              className="peer border-line-strong checked:border-ink checked:bg-ink focus-visible:ring-ink size-[1.15rem] appearance-none border bg-white transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <Check
              className="pointer-events-none absolute size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </span>
          <span>Keep me signed in</span>
        </label>
        <Link
          href="/auth?mode=forgot"
          className="underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
        >
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group bg-ink mt-7 flex h-14 w-full items-center justify-center px-5 text-sm font-medium text-white shadow-[0_8px_24px_rgb(17_17_16_/_12%)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:shadow-[0_14px_34px_rgb(17_17_16_/_18%)] active:translate-y-0 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-75"
      >
        <span className="grid flex-1 place-items-center">
          <span className="col-start-1 row-start-1 flex items-center gap-2">
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? "Signing in" : "Sign in"}
          </span>
        </span>
        <ArrowRight
          className={`size-[1.15rem] shrink-0 transition-transform duration-200 ${pending ? "opacity-0" : "group-hover:translate-x-0.5"}`}
          aria-hidden="true"
        />
      </button>
    </form>
  );
}
