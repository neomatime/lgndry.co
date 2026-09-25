"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useNav } from "@/components/site/nav-context";
import { useCartCount } from "@/features/shop/cart/use-cart-count";
import { cn } from "@/lib/utils/cn";

export function SiteHeader() {
  const { open, openNav, triggerRef } = useNav();
  const cartCount = useCartCount();
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
        <Link
          href="/cart"
          className="commerce-cart-link commerce-cart-link--header"
          data-commerce-cart-link=""
          aria-label={
            cartCount
              ? `View shopping cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
              : "View shopping cart, empty"
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 5h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 8H6" />
            <circle cx="10" cy="20" r="1" />
            <circle cx="17" cy="20" r="1" />
          </svg>
          <span data-commerce-cart-count="" hidden={cartCount === 0}>
            {cartCount}
          </span>
        </Link>
      </div>
    </header>
  );
}
