"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/features/auth/actions/sign-in";
import { Button } from "@/components/ui/button";

const initialState: SignInState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className="border-line-strong focus-visible:outline-ink h-10 border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className="border-line-strong focus-visible:outline-ink h-10 border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </div>

      {state.error ? (
        <p id="login-error" role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
