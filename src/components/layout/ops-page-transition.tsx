"use client";

import { usePathname } from "next/navigation";

export function OpsPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="ops-page-enter min-w-0">
      {children}
    </div>
  );
}
