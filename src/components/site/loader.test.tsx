import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Loader } from "@/components/site/loader";

const KEY = "lgndry_loaded";

function mockMedia(reducedMotion: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const loader = (container: HTMLElement) => container.querySelector("#loader") as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  mockMedia(false);
});
afterEach(() => vi.useRealTimers());

describe("Loader", () => {
  it("shows the intro on a first visit, slides away after the hold, then stays hidden", () => {
    const { container } = render(<Loader />);
    expect(loader(container).className).toBe("loader");
    expect(loader(container)).toHaveAttribute("aria-hidden", "true");

    act(() => vi.advanceTimersByTime(940));
    expect(loader(container).className).toBe("loader"); // still holding

    act(() => vi.advanceTimersByTime(20));
    expect(loader(container)).toHaveClass("loader--exit");

    // No transitionend in jsdom: the fallback timer finishes it.
    act(() => vi.advanceTimersByTime(900));
    expect(loader(container)).toHaveClass("loader--hidden");
    expect(window.sessionStorage.getItem(KEY)).toBe("1");
  });

  it("finishes as soon as the slide-up transition ends, without waiting for the fallback", () => {
    const { container } = render(<Loader />);
    act(() => vi.advanceTimersByTime(960));
    expect(loader(container)).toHaveClass("loader--exit");

    act(() => {
      loader(container).dispatchEvent(new Event("transitionend", { bubbles: true }));
    });
    expect(loader(container)).toHaveClass("loader--hidden");
    expect(window.sessionStorage.getItem(KEY)).toBe("1");
  });

  it("is skipped for a returning visitor in the same session", () => {
    window.sessionStorage.setItem(KEY, "1");
    const { container } = render(<Loader />);
    expect(loader(container)).toHaveClass("loader--hidden");
    act(() => vi.advanceTimersByTime(3000));
    expect(loader(container)).not.toHaveClass("loader--exit");
  });

  it("is skipped for visitors who prefer reduced motion, and remembers that", () => {
    mockMedia(true);
    const { container } = render(<Loader />);
    expect(loader(container)).toHaveClass("loader--hidden");
    expect(window.sessionStorage.getItem(KEY)).toBe("1");
  });

  it("still plays if sessionStorage is blocked", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      const { container } = render(<Loader />);
      expect(loader(container).className).toBe("loader");
      act(() => vi.advanceTimersByTime(960));
      expect(loader(container)).toHaveClass("loader--exit");
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
