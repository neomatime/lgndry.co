"use client";

import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inviteTeamMember, removeTeamMember } from "@/features/team/actions";
import type { TeamMember } from "@/features/team/types";

type Feedback = { status: "success" | "error"; message: string } | null;

const inputClass =
  "border-line-strong bg-surface focus-visible:outline-ink mt-1.5 h-10 w-full rounded-[var(--ops-radius-sm)] border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function TeamManager({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,.75fr)]">
      <section className="border-line bg-surface overflow-hidden rounded-[var(--ops-radius)] border shadow-[var(--ops-shadow-resting)]">
        <header className="border-line flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Team members</h2>
            <p className="text-ink-muted mt-1 text-sm">People with access to the Command Center.</p>
          </div>
          <span className="bg-surface-soft rounded-full px-2.5 py-1 text-xs font-medium">
            {members.length}
          </span>
        </header>
        <div className="divide-line divide-y">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-5 py-4">
              <span className="bg-surface-soft flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {initials(member.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.email}{" "}
                  {member.isYou ? <span className="text-ink-muted">(you)</span> : null}
                </p>
                <p className="text-ink-muted mt-0.5 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="size-3.5" aria-hidden="true" /> Administrator
                </p>
              </div>
              {!member.isYou ? (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Remove ${member.email}`}
                  title={`Remove ${member.email}`}
                  className="border-line hover:bg-surface-soft flex size-9 items-center justify-center rounded-[var(--ops-radius-sm)] border"
                  onClick={() => {
                    if (!window.confirm(`Remove ${member.email}'s Command Center access?`)) return;
                    setFeedback(null);
                    startTransition(async () => {
                      const result = await removeTeamMember({ userId: member.id });
                      setFeedback({
                        status: result.status === "success" ? "success" : "error",
                        message: result.message,
                      });
                      if (result.status === "success") router.refresh();
                    });
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <form
        className="border-line bg-surface h-fit rounded-[var(--ops-radius)] border p-5 shadow-[var(--ops-shadow-resting)]"
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          setFeedback(null);
          startTransition(async () => {
            const result = await inviteTeamMember({
              email: form.get("email"),
              password: form.get("password"),
            });
            setFeedback({
              status: result.status === "success" ? "success" : "error",
              message: result.message,
            });
            if (result.status === "success") {
              formElement.reset();
              router.refresh();
            }
          });
        }}
      >
        <span className="bg-surface-soft flex size-10 items-center justify-center rounded-full">
          <UserPlus className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Add team member</h2>
        <p className="text-ink-muted mt-1 text-sm leading-6">
          Create their account with a temporary password. Ask them to change it from Profile after
          signing in.
        </p>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            Email address
            <input name="email" type="email" autoComplete="email" required className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            Temporary password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
          </label>
          {feedback ? (
            <p
              role={feedback.status === "success" ? "status" : "alert"}
              className="text-sm font-medium"
            >
              {feedback.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            <UserPlus className="size-4" aria-hidden="true" />
            {pending ? "Adding..." : "Add Team Member"}
          </Button>
        </div>
      </form>
    </div>
  );
}
