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
