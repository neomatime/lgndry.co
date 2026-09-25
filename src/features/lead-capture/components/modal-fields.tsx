"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

/** A labelled field row. `wide` spans the full width of the two-column grid. */
export function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("booking-modal__field", wide && "booking-modal__field--wide")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Textarea with a live "n/500" character count. */
export function CountedTextarea({
  name,
  placeholder,
  max = 500,
}: {
  name: string;
  placeholder: string;
  max?: number;
}) {
  const [length, setLength] = useState(0);
  return (
    <>
      <textarea
        name={name}
        maxLength={max}
        rows={5}
        placeholder={placeholder}
        required
        onChange={(event) => setLength(event.target.value.length)}
      />
      <small>
        {length}/{max}
      </small>
    </>
  );
}

/** "Choose one or more" checkbox set that must have at least one ticked. */
export function CheckboxGroup({
  legend,
  name,
  options,
  error,
  invalid,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  error: string;
  invalid: boolean;
  onChange: () => void;
}) {
  return (
    <fieldset className={cn("booking-modal__services", invalid && "has-error")}>
      <legend>{legend}</legend>
      <p>Choose one or more</p>
      {options.map((option) => (
        <label key={option}>
          <input type="checkbox" name={name} value={option} onChange={onChange} />
          <span>{option}</span>
        </label>
      ))}
      <small className={cn("booking-modal__error", invalid && "is-visible")}>{error}</small>
    </fieldset>
  );
}
