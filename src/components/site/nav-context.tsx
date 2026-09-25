"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";

type NavState = {
  /** The panel is open (or in the short closing hand-off). */
  open: boolean;
  /** The menu links are shown. Cleared the instant closing starts. */
  itemsVisible: boolean;
  /** Increments on every open so the link stagger replays each time. */
  session: number;
  openNav: () => void;
  closeNav: () => void;
  /** The header's Menu button, so focus can return to it on close. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  reducedMotion: boolean;
};

const NavContext = createContext<NavState | null>(null);

/** Gives the header's Menu button (in the layout) and the panel one shared open state. */
export function NavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [itemsVisible, setItemsVisible] = useState(false);
  const [session, setSession] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const openNav = useCallback(() => {
    if (open) return;
    window.clearTimeout(closeTimer.current);
    setSession((value) => value + 1);
    setOpen(true);
    setItemsVisible(true);
  }, [open]);

  const closeNav = useCallback(() => {
    if (!open) return;
    // Links fade out first; the panel slides away a beat later.
    setItemsVisible(false);
    closeTimer.current = window.setTimeout(
      () => {
        setOpen(false);
        triggerRef.current?.focus();
      },
      reducedMotion ? 0 : 100,
    );
  }, [open, reducedMotion]);

  const value = useMemo(
    () => ({ open, itemsVisible, session, openNav, closeNav, triggerRef, reducedMotion }),
    [open, itemsVisible, session, openNav, closeNav, reducedMotion],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavState {
  const context = useContext(NavContext);
  if (!context) throw new Error("useNav must be used inside <NavProvider>");
  return context;
}
