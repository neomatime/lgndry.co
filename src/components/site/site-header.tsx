"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CartLink } from "@/components/site/cart-link";
import { useNav } from "@/components/site/nav-context";
import { cn } from "@/lib/utils/cn";

export function SiteHeader() {
  const { open, openNav, triggerRef } = useNav();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      setScrolled(window.scrollY > 24);
    };
    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };
    // Also picks up a scroll position restored by the browser on reload.
    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    return () => window.removeEventListener("scroll", requestUpdate);
  }, []);

  return (
    <header className={cn("page-header", scrolled && "page-header--scrolled")}>
      <button
        ref={triggerRef}
        type="button"
        className="site-nav__trigger page-header__menu"
        id="navTrigger"
        aria-expanded={open}
        aria-controls="navPanel"
        onClick={openNav}
        // Hidden while the panel is open; the panel has its own Close button.
        style={open ? { opacity: 0, pointerEvents: "none" } : undefined}
      >
        Menu
      </button>
      <div className="page-header__actions">
        <Link className="page-header__brand" href="/">
          LGNDRY.Co
        </Link>
        <CartLink />
      </div>
    </header>
  );
}
