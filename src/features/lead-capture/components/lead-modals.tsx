"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { bookingConfig } from "@/features/lead-capture/components/booking-config";
import { LeadModal } from "@/features/lead-capture/components/lead-modal";
import { partnershipConfig } from "@/features/lead-capture/components/partnership-config";

type Kind = "booking" | "partnership";

type LeadModalsApi = {
  openBooking: (trigger?: HTMLElement | null) => void;
  openPartnership: (trigger?: HTMLElement | null) => void;
};

const LeadModalsContext = createContext<LeadModalsApi | null>(null);

function useLeadModals(): LeadModalsApi {
  const context = useContext(LeadModalsContext);
  if (!context) throw new Error("Lead modal triggers must be inside <LeadModalsProvider>");
  return context;
}

/**
 * Owns the booking and partnership dialogs for the whole public site. Each is
 * built the first time it's opened (not on every page load), and the form
 * always starts fresh — closing and reopening never shows stale answers.
 */
export function LeadModalsProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Kind | null>(null);
  const [built, setBuilt] = useState<Record<Kind, boolean>>({ booking: false, partnership: false });
  const [sessions, setSessions] = useState<Record<Kind, number>>({ booking: 0, partnership: 0 });
  const lastFocused = useRef<HTMLElement | null>(null);

  const open = useCallback((kind: Kind, trigger?: HTMLElement | null) => {
    lastFocused.current = trigger ?? (document.activeElement as HTMLElement | null);
    setBuilt((state) => ({ ...state, [kind]: true }));
    setSessions((state) => ({ ...state, [kind]: state[kind] + 1 }));
    setActive(kind);
  }, []);

  const close = useCallback(() => {
    setActive(null);
    lastFocused.current?.focus?.();
  }, []);

  const api = useMemo<LeadModalsApi>(
    () => ({
      openBooking: (trigger) => open("booking", trigger),
      openPartnership: (trigger) => open("partnership", trigger),
    }),
    [open],
  );

  return (
    <LeadModalsContext.Provider value={api}>
      {children}
      {built.booking ? (
        <LeadModal
          config={bookingConfig}
          open={active === "booking"}
          onClose={close}
          session={sessions.booking}
        />
      ) : null}
      {built.partnership ? (
        <LeadModal
          config={partnershipConfig}
          open={active === "partnership"}
          onClose={close}
          session={sessions.partnership}
        />
      ) : null}
    </LeadModalsContext.Provider>
  );
}

type TriggerProps = {
  /** Where the link goes if JavaScript hasn't loaded: a pre-filled email. */
  href: string;
  className?: string;
  children: React.ReactNode;
};

/** A link that opens the booking dialog (falls back to `href` without JavaScript). */
export function BookingTrigger({ href, className, children }: TriggerProps) {
  const { openBooking } = useLeadModals();
  return (
    <a
      href={href}
      className={className}
      data-booking-modal=""
      onClick={(event) => {
        event.preventDefault();
        openBooking(event.currentTarget);
      }}
    >
      {children}
    </a>
  );
}

/** A link that opens the brand-partnership dialog (falls back to `href` without JavaScript). */
export function PartnershipTrigger({ href, className, children }: TriggerProps) {
  const { openPartnership } = useLeadModals();
  return (
    <a
      href={href}
      className={className}
      data-partnership-modal=""
      onClick={(event) => {
        event.preventDefault();
        openPartnership(event.currentTarget);
      }}
    >
      {children}
    </a>
  );
}
