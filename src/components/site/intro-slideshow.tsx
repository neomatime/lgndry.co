"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/site/reveal";
import { useHydrated } from "@/hooks/use-hydrated";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils/cn";

export type Slide = { src: string; alt: string; width: number; height: number };

const HOLD_MS = 5000; // display time per image — matches the 5s zoom
const FADE_MS = 1400; // cross-dissolve — matches the CSS opacity transition

/** Slowly zooming photographs that cross-dissolve, one after another. */
export function IntroSlideshow({ slides }: { slides: Slide[] }) {
  const hydrated = useHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState<{ current: number; previous: number | null }>({
    current: 0,
    previous: null,
  });
  const animate = hydrated && !reducedMotion && slides.length > 1;

  // Advance every HOLD_MS. The old slide stays visible underneath while the
  // new one fades in on top, then is released.
  useEffect(() => {
    if (!animate) return;
    let releaseTimer: number | undefined;
    const interval = window.setInterval(() => {
      setState((prior) => ({
        current: (prior.current + 1) % slides.length,
        previous: prior.current,
      }));
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(
        () => setState((prior) => ({ ...prior, previous: null })),
        FADE_MS,
      );
    }, HOLD_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(releaseTimer);
    };
  }, [animate, slides.length]);

  return (
    <Reveal as="figure" className="intro-band__figure" data-intro-slideshow="">
      {slides.map((slide, index) => {
        const isCurrent = index === state.current;
        const isPrevious = index === state.previous;
        return (
          <Image
            key={slide.src}
            className={cn(
              "intro-band__slide",
              (isCurrent || isPrevious) && "is-visible",
              // The zoom class is (re)added each time a slide is shown, which
              // restarts its CSS animation from the beginning.
              animate && (isCurrent || isPrevious) && "is-zooming",
            )}
            style={{ zIndex: isCurrent ? 3 : isPrevious ? 2 : 1 }}
            src={slide.src}
            alt={slide.alt}
            aria-hidden={slide.alt === "" ? true : undefined}
            width={slide.width}
            height={slide.height}
            loading="lazy"
          />
        );
      })}
    </Reveal>
  );
}
