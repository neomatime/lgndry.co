"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { clamp, galleryFrame } from "@/components/site/scroll-math";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils/cn";

export type GalleryCopy = {
  /** Modifier for the copy block's position on screen, e.g. "upper" or "right". */
  position: string;
  title: string;
  text: string;
};

export type GalleryImage = { src: string; width: number; height: number };

/**
 * A pinned section: as the visitor scrolls through it, photographs dissolve
 * one into the next while a different line of copy is shown for each.
 */
export function ScrollGallery({
  label,
  copies,
  images,
}: {
  label: string;
  copies: GalleryCopy[];
  images: GalleryImage[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState({ copy: 0, image: 0 });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return; // static first frame, per legacy behaviour

    let ticking = false;

    const update = () => {
      ticking = false;
      const scrollLength = Math.max(section.offsetHeight - window.innerHeight, 1);
      const progress = clamp(-section.getBoundingClientRect().top / scrollLength, 0, 1);
      const frame = galleryFrame(progress, images.length);

      frame.images.forEach((imageFrame, index) => {
        const element = imageRefs.current[index];
        if (!element) return;
        element.style.opacity = imageFrame.opacity.toFixed(3);
        element.style.transform = `scale(${imageFrame.scale.toFixed(4)}) translate3d(0, ${imageFrame.drift.toFixed(2)}px, 0)`;
      });

      if (progressRef.current) progressRef.current.style.width = `${(progress * 100).toFixed(2)}%`;

      // State only changes when the active copy/image actually changes.
      setActive((prior) =>
        prior.copy === frame.activeCopy && prior.image === frame.primary
          ? prior
          : { copy: frame.activeCopy, image: frame.primary },
      );
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
  }, [reducedMotion, images.length]);

  return (
    <section
      ref={sectionRef}
      className="philosophy-gallery"
      aria-label={label}
      data-scroll-gallery=""
    >
      <div className="philosophy-gallery__pin">
        <div className="philosophy-gallery__copy-stack">
          {copies.map((copy, index) => (
            <article
              key={copy.title}
              className={cn(
                "philosophy-gallery__copy",
                index === active.copy && "philosophy-gallery__copy--active",
                `philosophy-gallery__copy--${copy.position}`,
              )}
              data-scroll-gallery-copy=""
            >
              <h2>{copy.title}</h2>
              <p>{copy.text}</p>
            </article>
          ))}
        </div>

        <div className="philosophy-gallery__stage" aria-hidden="true">
          {images.map((image, index) => (
            <Image
              key={image.src}
              ref={(element) => {
                imageRefs.current[index] = element;
              }}
              className={cn(
                "philosophy-gallery__image",
                index === active.image && "philosophy-gallery__image--active",
              )}
              data-scroll-gallery-image=""
              src={image.src}
              alt=""
              width={image.width}
              height={image.height}
              loading="lazy"
            />
          ))}
        </div>

        <div className="philosophy-gallery__progress" aria-hidden="true">
          <span ref={progressRef} data-scroll-gallery-progress="" />
        </div>
      </div>
    </section>
  );
}
