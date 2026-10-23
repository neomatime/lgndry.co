"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 520;

export function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || value <= 0 || typeof window.requestAnimationFrame !== "function") {
      const timeout = window.setTimeout(() => setDisplayValue(value), 0);
      return () => window.clearTimeout(timeout);
    }

    let startedAt: number | null = null;
    let frame = 0;
    const animate = (now: number) => {
      startedAt ??= now;
      const progress = Math.min((now - startedAt) / DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <span className="tabular-nums">{displayValue.toLocaleString("en-ZA")}</span>;
}
