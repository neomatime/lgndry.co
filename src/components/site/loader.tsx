"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "lgndry_loaded";
const HOLD_MS = 950;
const EXIT_FALLBACK_MS = 900;

const noSubscribe = () => () => {};

function readSeenFlag(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false; // storage blocked: behave like a first visit
  }
}

function markSeen() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore: the intro just plays again next time
  }
}

type Phase = "showing" | "exiting" | "done";

/**
 * The branded wordmark intro. Plays once per browser session, is skipped for
 * returning visitors and for reduced-motion users.
 *
 * The server always renders it visible; an inline script in the layout head
 * (and a reduced-motion rule in overrides.css) hides it before first paint
 * for the visitors who shouldn't see it, so there's no flash.
 */
export function Loader() {
  const reducedMotion = usePrefersReducedMotion();
  const seenBefore = useSyncExternalStore(noSubscribe, readSeenFlag, () => false);
  const [phase, setPhase] = useState<Phase>("showing");
  const skip = seenBefore || reducedMotion;

  useEffect(() => {
    if (reducedMotion) markSeen();
  }, [reducedMotion]);

  useEffect(() => {
    if (skip) return;
    const timer = window.setTimeout(() => setPhase("exiting"), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [skip]);

  const finish = () => {
    setPhase("done");
    markSeen();
  };

  // If the slide-up transition never reports back, finish anyway.
  useEffect(() => {
    if (phase !== "exiting") return;
    const timer = window.setTimeout(finish, EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const hidden = skip || phase === "done";

  return (
    <div
      className={cn("loader", phase === "exiting" && "loader--exit", hidden && "loader--hidden")}
      id="loader"
      aria-hidden="true"
      onTransitionEnd={() => {
        if (phase === "exiting") finish();
      }}
    >
      <div className="loader__wordmark">
        {["L", "G", "N", "D", "R", "Y", ".", "C", "o"].map((letter, index) => (
          <span key={index}>{letter}</span>
        ))}
      </div>
    </div>
  );
}
