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

// Order and labels follow the approved desktop shell (PRD §5).
const NAV_ITEMS: NavItem[] = [
  { label: "Command Center", href: "/ops", icon: House, available: true },
  { label: "Enquiries", href: "/ops/enquiries", icon: Mail, available: false },
  { label: "Projects", href: "/ops/projects", icon: Folder, available: false },
  { label: "Clients", href: "/ops/clients", icon: Users, available: false },
  { label: "Inbox", href: "/ops/inbox", icon: Inbox, available: false },
  { label: "Follow-ups", href: "/ops/follow-ups", icon: CalendarCheck, available: false },
  { label: "Invoices", href: "/ops/invoices", icon: FileText, available: false },
  { label: "Settings", href: "/ops/settings", icon: Settings, available: false },
];

const itemClasses =
  "flex shrink-0 items-center gap-3 px-3 py-2.5 text-sm whitespace-nowrap transition-colors";

export function OpsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Command Center"
      className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon, available }) => {
        if (!available) {
          return (
            <span
              key={href}
              aria-disabled="true"
              className={cn(itemClasses, "text-ink-muted/60 cursor-not-allowed")}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {label}
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
            className={cn(itemClasses, active ? "bg-line/70 font-medium" : "hover:bg-line/40")}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
