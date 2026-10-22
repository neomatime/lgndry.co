import type { OpsUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { OpsSearch } from "@/features/ops-search/components/ops-search";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}` : name.slice(0, 2);
  return letters.toUpperCase();
}

export function OpsTopbar({ user }: { user: OpsUser }) {
  return (
    <header className="border-line sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/95 px-4 lg:px-7 xl:px-8">
      <OpsSearch />
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-ink flex size-8 items-center justify-center rounded-full text-xs font-medium text-white"
        >
          {initials(user.name)}
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-ink-muted text-xs">Admin</p>
        </div>
      </div>
      <form action="/auth/logout" method="post">
        <Button
          type="submit"
          variant="secondary"
          className="hidden h-8 px-3 text-xs sm:inline-flex"
        >
          Sign out
        </Button>
      </form>
    </header>
  );
}
