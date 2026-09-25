import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library can't register its own
// auto-cleanup; unmount rendered trees between tests ourselves.
afterEach(() => cleanup());

// jsdom doesn't implement layout, so scrolling is a no-op there.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Nor does it implement media queries (nobody prefers reduced motion in a
// test) or IntersectionObserver (nothing ever scrolls into view).
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
if (!(window as { IntersectionObserver?: unknown }).IntersectionObserver) {
  class NoopIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}
