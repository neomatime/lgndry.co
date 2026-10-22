"use client";

import { useEffect, useState } from "react";
import { OpsPageTransition } from "@/components/layout/ops-page-transition";
import { OpsSidebar } from "@/components/layout/ops-sidebar";
import { OpsTopbar } from "@/components/layout/ops-topbar";
import type { OpsUser } from "@/lib/auth/server";

const SIDEBAR_KEY = "lgndry.ops.sidebar-collapsed";

export function OpsShell({ user, children }: { user: OpsUser; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "true");
      setPreferenceLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (preferenceLoaded) window.localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  }, [collapsed, preferenceLoaded]);

  return (
    <div className="bg-surface-soft/35 flex min-h-dvh flex-col lg:flex-row">
      <OpsSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OpsTopbar user={user} />
        <main className="flex-1 px-4 py-6 lg:px-7 lg:py-7 xl:px-8">
          <OpsPageTransition>{children}</OpsPageTransition>
        </main>
      </div>
    </div>
  );
}
