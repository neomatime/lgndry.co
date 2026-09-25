"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { heroFrame, clamp } from "@/components/site/scroll-math";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";

/**
 * The homepage hero. It sits in a tall "runway" and stays pinned while the
 * visitor scrolls; scroll progress through the runway drives a cinematic
 * exit: text fades and drifts up, the photograph slowly zooms and blurs.
 *
 * Styles are written straight to the elements (no React state) because this
 * runs on every scroll frame.
 */
export function HeroScroll() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || reducedMotion) return; // the CSS fallback removes the runway

    const text = wrapper.querySelector<HTMLElement>(".hero__text");
    const shortCopy = wrapper.querySelector<HTMLElement>(".hero__short-copy-group");
    const image = wrapper.querySelector<HTMLElement>(".hero__image");
    if (!image) return;

    let ticking = false;
    let lastFade = -1;
    let lastScale = "";
    let lastBlur = "";

    const update = () => {
      ticking = false;
      const runway = wrapper.offsetHeight - window.innerHeight;
      if (runway <= 0) return;
      const progress = clamp(-wrapper.getBoundingClientRect().top / runway, 0, 1);
      const { fade, scale, blur } = heroFrame(progress);

      if (text && fade !== lastFade) {
        const transform = `translate3d(0, ${(-fade * 64).toFixed(1)}px, 0)`;
        text.style.opacity = (1 - fade).toFixed(3);
        text.style.transform = transform;
        text.style.pointerEvents = fade > 0.5 ? "none" : "";
        if (shortCopy) {
          shortCopy.style.opacity = (1 - fade).toFixed(3);
          shortCopy.style.transform = transform;
        }
        lastFade = fade;
      }

      const scaleValue = scale.toFixed(4);
      if (scaleValue !== lastScale) {
        image.style.transform = `scale(${scaleValue})`;
        lastScale = scaleValue;
      }

      // Quantise blur to quarter-pixel steps so we only re-rasterise when the
      // value meaningfully changes.
      const blurValue = (Math.round(blur * 4) / 4).toFixed(2);
      if (blurValue !== lastBlur) {
        image.style.filter = parseFloat(blurValue) > 0 ? `blur(${blurValue}px)` : "none";
        lastBlur = blurValue;
      }
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [reducedMotion]);

  return (
    <div className="hero-scroll" data-hero-scroll ref={wrapperRef}>
      <section className="hero" role="banner">
        <Image
          className="hero__image"
          src="/assests/images/optimized/home-hero.webp"
          alt="A figure stands in a golden field beneath a hazy sky — Limpopo, South Africa"
          width={2400}
          height={1350}
          priority
        />
        <div className="hero__overlay">
          <div className="hero__text">
            <h1 className="hero__headline">
              Found Beauty
              <br />
              in the Mundane.
            </h1>
          </div>
          <div className="hero__short-copy-group">
            <p className="hero__short-copy">
              We are a creative studio and fine art collective,
              <br />
              capturing stories that often go unnoticed.
            </p>
            <a className="hero__cta" href="#intro">
              <span className="hero__cta-label">Explore our world</span>
              <span className="hero__cta-arrow" aria-hidden="true">
                <svg
                  width="40"
                  height="8"
                  viewBox="0 0 40 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" strokeWidth="1" />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
