"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_KEY = "lgndry.ops.theme";

export function OpsThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    setDark(next);
  };

  const Icon = dark ? Sun : Moon;
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="border-line hover:bg-surface-soft flex size-9 items-center justify-center rounded-[var(--ops-radius-sm)] border bg-transparent transition-colors"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
