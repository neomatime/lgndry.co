import { Wordmark } from "@/components/branding/wordmark";
import { OpsNav } from "@/components/layout/ops-nav";

export function OpsSidebar() {
  return (
    <aside className="bg-surface-soft border-line flex flex-col gap-4 border-b p-4 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:gap-8 lg:border-r lg:border-b-0 lg:p-5">
      <Wordmark />
      <OpsNav />
      <p className="text-ink-muted mt-auto hidden text-[0.6rem] leading-relaxed tracking-[0.2em] uppercase lg:block">
        Extraordinary stories.
        <br />
        Real-world impact.
      </p>
    </aside>
  );
}
