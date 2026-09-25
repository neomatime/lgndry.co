"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils/cn";

type RevealProps = React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "figure" | "article" | "section" | "aside";
};

/**
 * Fades and lifts its content in the first time it scrolls into view.
 * Content stays in the DOM the whole time (only opacity/transform animate), so
 * it remains available to assistive tech; reduced-motion users see it at once.
 */
export function Reveal({ as = "div", className, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={cn("reveal", (seen || reducedMotion) && "reveal--visible", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
