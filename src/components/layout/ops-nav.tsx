"use client";

import {
  CalendarCheck,
  FileText,
  Folder,
  House,
  Inbox,
  Mail,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** false until the module is built; unbuilt modules render as disabled, not as dead links. */
  available: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

// Grouping improves scanability while preserving the owner's mandated item order.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Command Center", href: "/ops", icon: House, available: true }],
  },
  {
    label: "Work",
    items: [
      { label: "Enquiries", href: "/ops/enquiries", icon: Mail, available: true },
      { label: "Projects", href: "/ops/projects", icon: Folder, available: true },
      { label: "Clients", href: "/ops/clients", icon: Users, available: true },
      { label: "Inbox", href: "/ops/inbox", icon: Inbox, available: true },
      { label: "Follow-ups", href: "/ops/follow-ups", icon: CalendarCheck, available: true },
    ],
  },
  {
    label: "Finance",
    items: [{ label: "Invoices", href: "/ops/invoices", icon: FileText, available: true }],
  },
  {
    label: "Workspace",
    items: [{ label: "Settings", href: "/ops/settings", icon: Settings, available: true }],
  },
];

const itemClasses =
  "flex shrink-0 items-center gap-3 rounded-[var(--ops-radius-sm)] px-3 py-2.5 text-sm whitespace-nowrap transition-[background-color,color] duration-[var(--ops-motion-fast)]";

export function OpsNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Command Center"
      className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-5 lg:overflow-visible"
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="contents lg:flex lg:flex-col lg:gap-1">
          <p
            className={cn(
              "text-ink-muted hidden px-3 text-[0.58rem] font-medium tracking-[0.18em] uppercase lg:block",
              collapsed && "lg:sr-only",
            )}
          >
            {group.label}
          </p>
          {group.items.map(({ label, href, icon: Icon, available }) => {
            if (!available) {
              return (
                <span
                  key={href}
                  aria-disabled="true"
                  title={collapsed ? label : undefined}
                  className={cn(itemClasses, "text-ink-muted/60 cursor-not-allowed")}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  <span className={cn(collapsed && "lg:sr-only")}>{label}</span>
                  <span className="ml-auto hidden text-[0.6rem] tracking-wider uppercase lg:inline">
                    Soon
                  </span>
                </span>
              );
            }
            const active = href === "/ops" ? pathname === "/ops" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  itemClasses,
                  collapsed && "lg:justify-center lg:px-0",
                  active
                    ? "bg-line/70 font-semibold shadow-[inset_0_0_0_1px_rgb(207_205_199_/_35%)]"
                    : "hover:bg-line/40",
                )}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                <span className={cn(collapsed && "lg:sr-only")}>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
