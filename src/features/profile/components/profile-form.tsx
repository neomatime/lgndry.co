"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateOpsPassword, updateOpsProfile } from "@/features/profile/actions";
import type { OpsUser } from "@/lib/auth/server";

type Feedback = { status: "success" | "error"; message: string } | null;

const inputClass =
  "border-line-strong bg-surface focus-visible:outline-ink mt-1.5 h-10 w-full rounded-[var(--ops-radius-sm)] border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  return feedback ? (
    <p role={feedback.status === "success" ? "status" : "alert"} className="text-sm font-medium">
      {feedback.message}
    </p>
  ) : null;
}

export function ProfileForm({ user }: { user: OpsUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [profilePending, startProfileTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form
        className="border-line bg-surface rounded-[var(--ops-radius)] border p-5 shadow-[var(--ops-shadow-resting)]"
        onSubmit={(event) => {
          event.preventDefault();
          setProfileFeedback(null);
          startProfileTransition(async () => {
            const result = await updateOpsProfile({ fullName: name });
            setProfileFeedback({
              status: result.status === "success" ? "success" : "error",
              message: result.message,
            });
            if (result.status === "success") router.refresh();
          });
        }}
      >
        <h2 className="text-lg font-semibold">Personal details</h2>
        <p className="text-ink-muted mt-1 text-sm">
          Used in the Command Center header and activity.
        </p>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            Full name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input
              value={user.email}
              readOnly
              className={`${inputClass} bg-surface-soft text-ink-muted`}
            />
          </label>
          <div className="flex min-h-10 items-center justify-between gap-4 pt-1">
            <FeedbackMessage feedback={profileFeedback} />
            <Button type="submit" disabled={profilePending || !name.trim()} className="ml-auto">
              {profilePending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>
      </form>

      <form
        className="border-line bg-surface rounded-[var(--ops-radius)] border p-5 shadow-[var(--ops-shadow-resting)]"
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          setPasswordFeedback(null);
          startPasswordTransition(async () => {
            const result = await updateOpsPassword({
              password: form.get("password"),
              confirmPassword: form.get("confirmPassword"),
            });
            setPasswordFeedback({
              status: result.status === "success" ? "success" : "error",
              message: result.message,
            });
            if (result.status === "success") formElement.reset();
          });
        }}
      >
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-ink-muted mt-1 text-sm">Choose a new password for your account.</p>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Confirm new password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <div className="flex min-h-10 items-center justify-between gap-4 pt-1">
            <FeedbackMessage feedback={passwordFeedback} />
            <Button type="submit" disabled={passwordPending} className="ml-auto">
              {passwordPending ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
