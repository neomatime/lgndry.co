"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DELIVERABLE_STATUSES,
  type ProjectDeliverableInput,
  type ProjectMilestoneInput,
  type ProjectTaskInput,
} from "@/features/projects/types";

const inputClass = "border-line-strong h-9 w-full border bg-white px-3 text-sm";

type Keyed<T> = T & { key: string };

function Controls({
  label,
  index,
  length,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  length: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        aria-label={`Move ${label} up`}
        className="hover:bg-line inline-flex size-8 items-center justify-center disabled:opacity-30"
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === length - 1}
        aria-label={`Move ${label} down`}
        className="hover:bg-line inline-flex size-8 items-center justify-center disabled:opacity-30"
      >
        <ArrowDown className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="hover:bg-line inline-flex size-8 items-center justify-center"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ProjectPlanEditor({
  milestones,
  tasks,
  deliverables,
  onMilestonesChange,
  onTasksChange,
  onDeliverablesChange,
}: {
  milestones: ProjectMilestoneInput[];
  tasks: ProjectTaskInput[];
  deliverables: ProjectDeliverableInput[];
  onMilestonesChange: (items: ProjectMilestoneInput[]) => void;
  onTasksChange: (items: ProjectTaskInput[]) => void;
  onDeliverablesChange: (items: ProjectDeliverableInput[]) => void;
}) {
  const nextKey = useRef(milestones.length + tasks.length + deliverables.length);
  const key = () => `plan-${nextKey.current++}`;
  const [milestoneRows, setMilestoneRows] = useState<Keyed<ProjectMilestoneInput>[]>(() =>
    milestones.map((item, index) => ({ ...item, key: item.id ?? `milestone-${index}` })),
  );
  const [taskRows, setTaskRows] = useState<Keyed<ProjectTaskInput>[]>(() =>
    tasks.map((item, index) => ({ ...item, key: item.id ?? `task-${index}` })),
  );
  const [deliverableRows, setDeliverableRows] = useState<Keyed<ProjectDeliverableInput>[]>(() =>
    deliverables.map((item, index) => ({ ...item, key: item.id ?? `deliverable-${index}` })),
  );

  const publish = <T,>(rows: Keyed<T>[]) =>
    rows.map(({ key: localKey, ...item }) => {
      void localKey;
      return item as T;
    });
  const update = <T,>(rows: Keyed<T>[], index: number, patch: Partial<T>) =>
    rows.map((item, position) => (position === index ? { ...item, ...patch } : item));
  const move = <T,>(rows: Keyed<T>[], index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= rows.length) return rows;
    const next = [...rows];
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    return next;
  };

  return (
    <section className="border-line border p-5 sm:p-6">
      <h2 className="text-lg font-medium">Production Plan</h2>
      <div className="mt-5 grid gap-6 xl:grid-cols-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Milestones</h3>
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-2"
              onClick={() => {
                const next = [
                  ...milestoneRows,
                  {
                    key: key(),
                    title: "",
                    description: "",
                    dueDate: "",
                    status: "Pending" as const,
                  },
                ];
                setMilestoneRows(next);
                onMilestonesChange(publish(next));
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {milestoneRows.map((item, index) => (
              <div key={item.key} className="border-line bg-surface-soft border p-3">
                <div className="flex justify-between gap-2">
                  <p className="text-xs font-medium">Milestone {index + 1}</p>
                  <Controls
                    label={`milestone ${index + 1}`}
                    index={index}
                    length={milestoneRows.length}
                    onMove={(direction) => {
                      const next = move(milestoneRows, index, direction);
                      setMilestoneRows(next);
                      onMilestonesChange(publish(next));
                    }}
                    onRemove={() => {
                      const next = milestoneRows.filter((_, position) => position !== index);
                      setMilestoneRows(next);
                      onMilestonesChange(publish(next));
                    }}
                  />
                </div>
                <input
                  aria-label={`Milestone ${index + 1} title`}
                  value={item.title}
                  onChange={(event) => {
                    const next = update(milestoneRows, index, { title: event.target.value });
                    setMilestoneRows(next);
                    onMilestonesChange(publish(next));
                  }}
                  className={inputClass}
                  placeholder="Title"
                />
                <textarea
                  aria-label={`Milestone ${index + 1} description`}
                  value={item.description}
                  onChange={(event) => {
                    const next = update(milestoneRows, index, { description: event.target.value });
                    setMilestoneRows(next);
                    onMilestonesChange(publish(next));
                  }}
                  className="border-line-strong mt-2 min-h-16 w-full border bg-white p-2 text-sm"
                  placeholder="Description"
                />
                <input
                  type="date"
                  aria-label={`Milestone ${index + 1} due date`}
                  value={item.dueDate}
                  onChange={(event) => {
                    const next = update(milestoneRows, index, { dueDate: event.target.value });
                    setMilestoneRows(next);
                    onMilestonesChange(publish(next));
                  }}
                  className={`${inputClass} mt-2`}
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Tasks</h3>
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-2"
              onClick={() => {
                const next = [
                  ...taskRows,
                  { key: key(), title: "", dueDate: "", isCompleted: false },
                ];
                setTaskRows(next);
                onTasksChange(publish(next));
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {taskRows.map((item, index) => (
              <div key={item.key} className="border-line bg-surface-soft border p-3">
                <div className="flex justify-between gap-2">
                  <p className="text-xs font-medium">Task {index + 1}</p>
                  <Controls
                    label={`task ${index + 1}`}
                    index={index}
                    length={taskRows.length}
                    onMove={(direction) => {
                      const next = move(taskRows, index, direction);
                      setTaskRows(next);
                      onTasksChange(publish(next));
                    }}
                    onRemove={() => {
                      const next = taskRows.filter((_, position) => position !== index);
                      setTaskRows(next);
                      onTasksChange(publish(next));
                    }}
                  />
                </div>
                <input
                  aria-label={`Task ${index + 1} title`}
                  value={item.title}
                  onChange={(event) => {
                    const next = update(taskRows, index, { title: event.target.value });
                    setTaskRows(next);
                    onTasksChange(publish(next));
                  }}
                  className={inputClass}
                  placeholder="Title"
                />
                <input
                  type="date"
                  aria-label={`Task ${index + 1} due date`}
                  value={item.dueDate}
                  onChange={(event) => {
                    const next = update(taskRows, index, { dueDate: event.target.value });
                    setTaskRows(next);
                    onTasksChange(publish(next));
                  }}
                  className={`${inputClass} mt-2`}
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Deliverables</h3>
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-2"
              onClick={() => {
                const next = [
                  ...deliverableRows,
                  { key: key(), title: "", dueDate: "", status: "Not Started" as const },
                ];
                setDeliverableRows(next);
                onDeliverablesChange(publish(next));
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {deliverableRows.map((item, index) => (
              <div key={item.key} className="border-line bg-surface-soft border p-3">
                <div className="flex justify-between gap-2">
                  <p className="text-xs font-medium">Deliverable {index + 1}</p>
                  <Controls
                    label={`deliverable ${index + 1}`}
                    index={index}
                    length={deliverableRows.length}
                    onMove={(direction) => {
                      const next = move(deliverableRows, index, direction);
                      setDeliverableRows(next);
                      onDeliverablesChange(publish(next));
                    }}
                    onRemove={() => {
                      const next = deliverableRows.filter((_, position) => position !== index);
                      setDeliverableRows(next);
                      onDeliverablesChange(publish(next));
                    }}
                  />
                </div>
                <input
                  aria-label={`Deliverable ${index + 1} title`}
                  value={item.title}
                  onChange={(event) => {
                    const next = update(deliverableRows, index, { title: event.target.value });
                    setDeliverableRows(next);
                    onDeliverablesChange(publish(next));
                  }}
                  className={inputClass}
                  placeholder="Title"
                />
                <input
                  type="date"
                  aria-label={`Deliverable ${index + 1} due date`}
                  value={item.dueDate}
                  onChange={(event) => {
                    const next = update(deliverableRows, index, { dueDate: event.target.value });
                    setDeliverableRows(next);
                    onDeliverablesChange(publish(next));
                  }}
                  className={`${inputClass} mt-2`}
                />
                <select
                  aria-label={`Deliverable ${index + 1} status`}
                  value={item.status}
                  onChange={(event) => {
                    const next = update(deliverableRows, index, {
                      status: event.target.value as ProjectDeliverableInput["status"],
                    });
                    setDeliverableRows(next);
                    onDeliverablesChange(publish(next));
                  }}
                  className={`${inputClass} mt-2`}
                >
                  {DELIVERABLE_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
