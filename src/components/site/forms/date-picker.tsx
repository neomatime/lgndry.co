"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MONTH_NAMES,
  WEEKDAYS,
  addMonths,
  buildCells,
  formatDisplay,
  parseISO,
  toISO,
} from "@/components/site/forms/date-utils";
import { cn } from "@/lib/utils/cn";

const POPUP_WIDTH = 296;

type DatePickerProps = {
  name: string;
  placeholder?: string;
};

/**
 * Themed date field with a popup calendar (the browser's own calendar can't be
 * styled). The chosen day is submitted as a "YYYY-MM-DD" hidden input, and the
 * visible field shows it as "Jan 5, 2026". Ported from the legacy date-picker.js.
 *
 * Deliberately unchanged: the field is not "required" (the legacy enhancement
 * swapped the real date input for a hidden one, which skips validation).
 * Fixed from legacy: Clear/Today now work, and the keyboard can open it.
 */
export function DatePicker({ name, placeholder = "Select date" }: DatePickerProps) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popupId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const openPopup = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const maxLeft = window.scrollX + document.documentElement.clientWidth - POPUP_WIDTH - 12;
    let left = window.scrollX + rect.left;
    if (left > maxLeft) left = Math.max(window.scrollX + 12, maxLeft);
    setPosition({ top: window.scrollY + rect.bottom + 6, left });
    const selected = parseISO(value);
    const base = selected ?? new Date();
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
    setOpen(true);
  };

  // Dismiss on outside press, Escape, resize, or any scroll.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!popupRef.current?.contains(target) && !wrapRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const pick = (iso: string) => {
    setValue(iso);
    setOpen(false);
  };

  const cells = open ? buildCells(view, value) : [];

  return (
    <>
      <span
        ref={wrapRef}
        className="datepicker-wrap"
        // Keeps focus where it is so the popup doesn't fight the field for it.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => (open ? setOpen(false) : openPopup())}
      >
        <input type="hidden" name={name} value={value} />
        <input
          type="text"
          className="datepicker-display"
          readOnly
          role="combobox"
          placeholder={placeholder}
          value={formatDisplay(parseISO(value))}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popupId}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
              event.preventDefault();
              openPopup();
            }
          }}
        />
        <span className="datepicker-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </span>
      </span>

      {open
        ? createPortal(
            <div
              ref={popupRef}
              id={popupId}
              className="datepicker-popup"
              role="dialog"
              aria-label="Choose date"
              style={{ top: position.top, left: position.left }}
            >
              <div className="datepicker-header">
                <span className="datepicker-nav">
                  <button
                    type="button"
                    className="datepicker-nav-btn"
                    aria-label="Previous month"
                    onClick={() => setView((current) => addMonths(current, -1))}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                </span>
                <span className="datepicker-title">
                  {MONTH_NAMES[view.getMonth()]} {view.getFullYear()}
                </span>
                <span className="datepicker-nav">
                  <button
                    type="button"
                    className="datepicker-nav-btn"
                    aria-label="Next month"
                    onClick={() => setView((current) => addMonths(current, 1))}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </span>
              </div>
              <div className="datepicker-weekdays">
                {WEEKDAYS.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>
              <div className="datepicker-grid">
                {cells.map((cell, index) =>
                  cell.muted ? (
                    <span key={`m${index}`} className="datepicker-cell datepicker-cell--muted">
                      {cell.label}
                    </span>
                  ) : (
                    <button
                      key={cell.iso}
                      type="button"
                      className={cn(
                        "datepicker-cell",
                        cell.isToday && "datepicker-cell--today",
                        cell.isSelected && "datepicker-cell--selected",
                      )}
                      onClick={() => pick(cell.iso)}
                    >
                      {cell.label}
                    </button>
                  ),
                )}
              </div>
              <div className="datepicker-footer">
                <button type="button" className="datepicker-link" onClick={() => pick("")}>
                  Clear
                </button>
                <button
                  type="button"
                  className="datepicker-link"
                  onClick={() => pick(toISO(new Date()))}
                >
                  Today
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
