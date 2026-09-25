"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type SelectProps = {
  /** Form field name; omit for a control that is only read through `onChange`. */
  name?: string;
  /** The choices, not including the empty "placeholder" entry. */
  options: readonly string[];
  /**
   * Label of the empty first entry, e.g. "Select one". Leave out for a control
   * that always has one of `options` chosen (the first, unless told otherwise).
   */
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  /** Makes the control controlled; pair with `onChange`. */
  value?: string;
  /** Names the control for assistive tech, e.g. "Print size for Gae". */
  label?: string;
  onChange?: (value: string) => void;
};

/**
 * The site's themed dropdown. A real, visually-hidden <select> stays in the
 * DOM so the browser's own validation and form submission keep working; the
 * button and list are the styled face. Ported from the legacy custom-select.js.
 */
export function Select({
  name,
  options,
  placeholder,
  required,
  defaultValue,
  value: controlledValue,
  label,
  onChange,
}: SelectProps) {
  const [ownValue, setOwnValue] = useState(
    defaultValue ?? (placeholder === undefined ? (options[0] ?? "") : ""),
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const value = controlledValue ?? ownValue;
  const entries = [
    ...(placeholder === undefined ? [] : [{ value: "", label: placeholder }]),
    ...options.map((o) => ({ value: o, label: o })),
  ];
  const selected = entries.find((entry) => entry.value === value) ?? entries[0];

  // Close on any click outside.
  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

  // Opening moves focus to the current choice so arrow keys work immediately.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, [open]);

  const change = (next: string) => {
    setOwnValue(next);
    onChange?.(next);
  };

  const choose = (next: string) => {
    change(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        ".lgndry-select__option:not(:disabled)",
      ) ?? [],
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      items[Math.min(items.length - 1, current + 1)]?.focus();
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      items[Math.max(0, current - 1)]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={cn("lgndry-select", open && "is-open")} onKeyDown={onKeyDown}>
      <select
        name={name}
        required={required}
        value={value}
        onChange={(event) => change(event.target.value)}
        className="lgndry-select__native"
        // The themed button/list is the accessible control; this native one only
        // carries the value and browser validation, so it's kept out of the
        // tab order and away from screen readers (the legacy version announced
        // every dropdown twice).
        aria-hidden="true"
        tabIndex={-1}
      >
        {entries.map((entry) => (
          <option key={entry.value || "__placeholder"} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>
      <button
        ref={triggerRef}
        type="button"
        className="lgndry-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label ? `${label}: ${selected?.label ?? ""}` : undefined}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span>{selected?.label}</span>
        <svg viewBox="0 0 12 7" aria-hidden="true">
          <path d="M1 1l5 5 5-5" />
        </svg>
      </button>
      <div ref={menuRef} className="lgndry-select__menu" role="listbox">
        {entries.map((entry) => (
          <button
            key={entry.value || "__placeholder"}
            type="button"
            className="lgndry-select__option"
            role="option"
            aria-selected={entry.value === value}
            onClick={() => choose(entry.value)}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
