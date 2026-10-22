import type { OpsUser } from "@/lib/auth/server";
import { OpsProfileMenu } from "@/components/layout/ops-profile-menu";
import { OpsThemeToggle } from "@/components/layout/ops-theme-toggle";
import { OpsSearch } from "@/features/ops-search/components/ops-search";

export function OpsTopbar({ user }: { user: OpsUser }) {
  return (
    <header className="border-line bg-surface/95 sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-4 backdrop-blur-sm lg:px-7 xl:px-8">
      <OpsSearch />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <OpsThemeToggle />
        <OpsProfileMenu user={user} />
      </div>
    </header>
  );
}
