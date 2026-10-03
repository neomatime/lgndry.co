"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FollowUpChecklistInput } from "@/features/follow-ups/types";

export const MAX_CHECKLIST_ITEMS = 50;

const inputClass = "border-line-strong h-10 w-full border bg-white px-3 text-sm";
const iconButtonClass =
  "hover:bg-line inline-flex size-8 items-center justify-center disabled:opacity-30";

type Row = { key: string; id?: string; label: string };
type Focus = { key: string; control: "up" | "down" | "label" } | "draft";

type Props = {
  /** Initial items; later edits are reported through `onChange`. */
  items: FollowUpChecklistInput[];
  onChange: (items: FollowUpChecklistInput[]) => void;
  /** Messages keyed by item index (from `checklist.<index>.label`). */
  itemErrors?: Record<number, string[]>;
  /** Messages about the list as a whole. */
  listErrors?: string[];
};

function publish(rows: Row[]): FollowUpChecklistInput[] {
  return rows.map((row, index) => ({
    ...(row.id ? { id: row.id } : {}),
    label: row.label,
    sortOrder: index,
  }));
}

/**
 * Ordered, editable checklist used while creating or editing a follow-up. It
 * only edits a local list that the surrounding form submits; ticking items
 * off on a saved follow-up is a separate, live control on the detail page.
 * Existing items keep their ids so the server can preserve their completion
 * history; new items have none.
 */
export function ChecklistEditor({ items, onChange, itemErrors = {}, listErrors }: Props) {
  const uid = useId();
  const nextKey = useRef(items.length);
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((item, index) => ({ key: `existing-${index}`, id: item.id, label: item.label })),
  );
  const [draft, setDraft] = useState("");
  const pendingFocus = useRef<Focus | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  // Restores keyboard focus after a structural change (add/move/remove) so the
  // user's place in the list is never lost when React re-orders the rows.
  useEffect(() => {
    const focus = pendingFocus.current;
    pendingFocus.current = null;
    if (!focus) return;
    if (focus === "draft") draftRef.current?.focus();
    else {
      const row = container.current?.querySelector<HTMLElement>(`[data-row="${focus.key}"]`);
      const wanted = row?.querySelector<HTMLElement>(`[data-control="${focus.control}"]`);
      const target =
        wanted && !(wanted as HTMLButtonElement).disabled
          ? wanted
          : row?.querySelector<HTMLElement>('[data-control="label"]');
      target?.focus();
    }
  }, [rows]);

  const commit = (next: Row[], nextFocus?: Focus) => {
    setRows(next);
    onChange(publish(next));
    if (nextFocus) pendingFocus.current = nextFocus;
  };

  function add() {
    const label = draft.trim();
    if (!label || rows.length >= MAX_CHECKLIST_ITEMS) return;
    const key = `new-${nextKey.current++}`;
    commit([...rows, { key, label }], "draft");
    setDraft("");
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= rows.length) return;
    const next = [...rows];
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    commit(next, { key: rows[index]!.key, control: direction === -1 ? "up" : "down" });
  }

  function remove(index: number) {
    const next = rows.filter((_, position) => position !== index);
    const neighbour = next[index] ?? next[index - 1];
    commit(next, neighbour ? { key: neighbour.key, control: "label" } : "draft");
  }

  const full = rows.length >= MAX_CHECKLIST_ITEMS;

  return (
    <div ref={container}>
      {rows.length ? (
        <ol className="space-y-2" aria-label="Checklist items">
          {rows.map((row, index) => {
            const errors = itemErrors[index];
            const inputId = `${uid}-item-${row.key}`;
            const errorId = `${inputId}-error`;
            return (
              <li key={row.key} data-row={row.key}>
                <div className="flex items-start gap-2">
                  <span className="text-ink-muted mt-2.5 w-6 shrink-0 text-right text-sm">
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <label htmlFor={inputId} className="sr-only">
                      {`Checklist item ${index + 1}`}
                    </label>
                    <input
                      id={inputId}
                      data-control="label"
                      value={row.label}
                      aria-invalid={errors?.length ? true : undefined}
                      aria-describedby={errors?.length ? errorId : undefined}
                      onChange={(event) =>
                        commit(
                          rows.map((item, position) =>
                            position === index ? { ...item, label: event.target.value } : item,
                          ),
                        )
                      }
                      onKeyDown={(event) => {
                        // Enter in a row is "done editing", never an accidental form submit.
                        if (event.key === "Enter") event.preventDefault();
                      }}
                      className={inputClass}
                    />
                    {errors?.length ? (
                      <p id={errorId} className="mt-1 text-xs font-medium">
                        {errors.join(" ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-control="up"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move item ${index + 1} up`}
                      className={iconButtonClass}
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      data-control="down"
                      onClick={() => move(index, 1)}
                      disabled={index === rows.length - 1}
                      aria-label={`Move item ${index + 1} down`}
                      className={iconButtonClass}
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={`Remove item ${index + 1}`}
                      className={iconButtonClass}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-ink-muted text-sm">No checklist items yet.</p>
      )}
      {listErrors?.length ? (
        <p role="alert" className="mt-2 text-xs font-medium">
          {listErrors.join(" ")}
        </p>
      ) : null}
      <div className="mt-4 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${uid}-draft`} className="text-sm font-medium">
            Add checklist item
          </label>
          <input
            id={`${uid}-draft`}
            ref={draftRef}
            value={draft}
            disabled={full}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            className={`${inputClass} mt-1.5`}
          />
        </div>
        <Button type="button" variant="secondary" onClick={add} disabled={full}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
      {full ? (
        <p className="text-ink-muted mt-2 text-xs">
          A follow-up can have up to {MAX_CHECKLIST_ITEMS} checklist items.
        </p>
      ) : null}
    </div>
  );
}
