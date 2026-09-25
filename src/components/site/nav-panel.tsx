"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNav } from "@/components/site/nav-context";
import { useCustomerSession } from "@/features/customer-account/use-customer-session";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils/cn";

type NavKey = "home" | "practice" | "collections" | "about" | "contact";

const ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "practice", label: "Practice", href: "/services" },
  { key: "collections", label: "Collections", href: "/collection" },
  { key: "about", label: "About", href: "/about" },
  { key: "contact", label: "Contact", href: "/contact" },
];

const PHOTOS: Record<NavKey, { src: string; width: number; height: number }> = {
  home: { src: "/assests/images/optimized/home-hero.webp", width: 2400, height: 1350 },
  practice: { src: "/assests/images/optimized/services-hero.webp", width: 1800, height: 1800 },
  collections: { src: "/assests/images/optimized/nav-collection.webp", width: 1120, height: 1400 },
  about: { src: "/assests/images/optimized/about-hero.webp", width: 2200, height: 1468 },
  contact: { src: "/assests/images/founder.jpeg", width: 853, height: 1280 },
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const STAGGER_START = 500;
const STAGGER_STEP = 80;

export function NavPanel() {
  const { open, itemsVisible, session, closeNav, triggerRef, reducedMotion } = useNav();
  const pathname = usePathname();
  const customer = useCustomerSession();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState<NavKey | null>(null);
  // Which links have appeared so far, for the current open. Keyed by session
  // so reopening starts from nothing and replays the stagger.
  const [revealed, setRevealed] = useState({ session: 0, count: 0 });

  // Stagger the links in one after another once the panel opens.
  useEffect(() => {
    if (!open) return;
    const timers = ITEMS.map((_, index) =>
      window.setTimeout(
        () => setRevealed({ session, count: index + 1 }),
        reducedMotion ? 0 : STAGGER_START + index * STAGGER_STEP,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [open, session, reducedMotion]);

  // Lock page scroll styling hooks used by the legacy CSS, and move focus in.
  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("nav-is-open");
    document.body.classList.add("nav-is-open");
    closeRef.current?.focus();
    return () => {
      document.documentElement.classList.remove("nav-is-open");
      document.body.classList.remove("nav-is-open");
    };
  }, [open]);

  // Escape closes; Tab stays inside the panel; a click outside closes.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeNav();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && target !== triggerRef.current) closeNav();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, [open, closeNav, triggerRef]);

  const activeKey: NavKey = hovered ?? "home";

  return (
    <div
      ref={panelRef}
      className={cn("nav-panel", open && "nav-panel--open")}
      id="navPanel"
      aria-hidden={!open}
      inert={!open}
    >
      <div
        className="nav-panel__links"
        // On small screens the active photo becomes the panel background.
        style={isMobile ? { backgroundImage: `url("${PHOTOS[activeKey].src}")` } : undefined}
      >
        <button
          ref={closeRef}
          type="button"
          className="nav-panel__close"
          id="navClose"
          onClick={closeNav}
        >
          Close
        </button>
        <ul
          className={cn("nav-panel__list", hovered && "nav-panel__list--hovering")}
          onMouseLeave={() => setHovered(null)}
        >
          {ITEMS.map(({ key, label, href }, index) => {
            const visible = itemsVisible && revealed.session === session && index < revealed.count;
            return (
              <li key={key}>
                <Link
                  className={cn(
                    "nav-panel__item",
                    visible && "nav-panel__item--visible",
                    hovered === key && "nav-panel__item--hovered",
                  )}
                  href={href}
                  data-nav-image={key}
                  aria-current={pathname === href ? "page" : undefined}
                  onMouseEnter={() => setHovered(key)}
                  onFocus={() => setHovered(key)}
                  onPointerDown={() => setHovered(key)}
                >
                  {label}
                </Link>
              </li>
            );
          })}
          {customer === "signed-in" ? (
            <li data-customer-nav="">
              <Link className="nav-panel__item nav-panel__item--account" href="/account#orders">
                My Account
              </Link>
            </li>
          ) : null}
          {customer === "signed-out" ? (
            <li data-customer-nav="">
              <div className="nav-panel__account-links">
                <Link href="/auth?mode=login">Log In</Link>
                <span></span>
                <Link href="/auth?mode=signup">Create Account</Link>
              </div>
            </li>
          ) : null}
        </ul>
      </div>

      <div className="nav-panel__preview" aria-hidden="true">
        {ITEMS.map(({ key }) => (
          <Image
            key={key}
            className={cn("nav-panel__photo", activeKey === key && "nav-panel__photo--active")}
            data-nav-photo={key}
            src={PHOTOS[key].src}
            alt=""
            width={PHOTOS[key].width}
            height={PHOTOS[key].height}
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}
