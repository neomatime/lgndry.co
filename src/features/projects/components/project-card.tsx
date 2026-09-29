"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, CheckSquare2, GripVertical, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PaymentStatusBadge } from "@/features/projects/components/project-badges";
import { getDeliverableProgress, getNextAction } from "@/features/projects/list-view-model";
import {
  PROJECT_STATUSES,
  type ProjectListItem,
  type ProjectStatus,
} from "@/features/projects/types";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeZone: "Africa/Johannesburg",
});

export function ProjectCard({
  project,
  selected,
  onSelect,
  onMove,
}: {
  project: ProjectListItem;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onMove: (status: ProjectStatus) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    data: { status: project.status },
  });
  const progress = getDeliverableProgress(project);
  const nextAction = getNextAction(project);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-line bg-surface relative border p-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(event.target.checked)}
          aria-label={`Preview ${project.name}`}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <p className="text-ink-muted text-[11px] tracking-wide uppercase">
            {project.id.slice(0, 8)}
          </p>
          <Link
            href={`/ops/projects/${project.id}`}
            className="mt-0.5 block text-sm font-medium hover:underline"
          >
            {project.name}
          </Link>
          <p className="text-ink-muted truncate text-xs">{project.clientName}</p>
        </div>
        <button
          type="button"
          aria-label={`Drag ${project.name}`}
          title={`Drag ${project.name}`}
          className="text-ink-muted hover:text-ink inline-flex size-7 shrink-0 touch-none items-center justify-center"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Move ${project.name}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="text-ink-muted hover:text-ink inline-flex size-7 shrink-0 items-center justify-center"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      </div>

      {menuOpen ? (
        <div className="border-line bg-surface absolute top-10 right-2 z-20 w-44 border p-1 shadow-sm">
          <p className="text-ink-muted px-2 py-1 text-[11px] tracking-wide uppercase">Move to</p>
          {PROJECT_STATUSES.filter((status) => status !== project.status).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onMove(status);
              }}
              className="hover:bg-surface-soft block w-full px-2 py-1.5 text-left text-xs"
            >
              {status}
            </button>
          ))}
        </div>
      ) : null}

      <dl className="text-ink-muted mt-3 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <CheckSquare2 className="size-3.5 shrink-0" aria-hidden="true" />
          <dd className="truncate">{nextAction?.title ?? "No pending task"}</dd>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          <dd>
            {project.startDate
              ? dateFormatter.format(new Date(`${project.startDate}T12:00:00Z`))
              : "Not scheduled"}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2">
        <PaymentStatusBadge status={project.paymentStatus} />
        <span className="text-ink-muted text-[11px]">
          {progress.completed}/{progress.total} delivered
        </span>
      </div>
      <div className="bg-line mt-2 h-1 overflow-hidden" aria-hidden="true">
        <div className="bg-ink h-full" style={{ width: `${progress.percent}%` }} />
      </div>
    </article>
  );
}
