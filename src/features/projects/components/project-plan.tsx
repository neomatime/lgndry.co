"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  setProjectDeliverableStatus,
  setProjectMilestoneCompleted,
  setProjectTaskCompleted,
} from "@/features/projects/actions";
import { DELIVERABLE_STATUSES, type ProjectDetail } from "@/features/projects/types";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeZone: "Africa/Johannesburg",
});

function dueDate(value: string) {
  return value ? dateFormatter.format(new Date(`${value}T12:00:00Z`)) : "No due date";
}

export function ProjectPlan({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ status: string; message?: string }>) {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        if (result.status !== "success") {
          setMessage(result.message ?? "The project plan could not be updated.");
          return;
        }
        setMessage("Project plan updated.");
        router.refresh();
      } catch {
        setMessage("The project plan could not be updated.");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section className="border-line border p-5">
        <h2 className="font-medium">Milestones ({project.milestones.length})</h2>
        {project.milestones.length ? (
          <ol className="mt-4 space-y-4">
            {project.milestones.map((milestone) => (
              <li key={milestone.id} className="border-line border-b pb-4 last:border-0 last:pb-0">
                <label className="flex items-start gap-3">
                  {!project.archived ? (
                    <input
                      type="checkbox"
                      checked={milestone.status === "Completed"}
                      disabled={pending}
                      onChange={(event) =>
                        run(() => setProjectMilestoneCompleted(milestone.id, event.target.checked))
                      }
                      aria-label={`Complete milestone ${milestone.title}`}
                      className="mt-1"
                    />
                  ) : null}
                  <span>
                    <span className="block text-sm font-medium">{milestone.title}</span>
                    {milestone.description ? (
                      <span className="text-ink-muted mt-1 block text-xs">
                        {milestone.description}
                      </span>
                    ) : null}
                    <span className="text-ink-muted mt-1 block text-xs">
                      {dueDate(milestone.dueDate)} · {milestone.status}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-ink-muted mt-3 text-sm">No milestones recorded.</p>
        )}
      </section>

      <section className="border-line border p-5">
        <h2 className="font-medium">Tasks ({project.tasks.length})</h2>
        {project.tasks.length ? (
          <ul className="mt-4 space-y-3">
            {project.tasks.map((task) => (
              <li key={task.id}>
                <label className="flex items-start gap-3">
                  {!project.archived ? (
                    <input
                      type="checkbox"
                      checked={task.isCompleted}
                      disabled={pending}
                      onChange={(event) =>
                        run(() => setProjectTaskCompleted(task.id, event.target.checked))
                      }
                      aria-label={`Complete task ${task.title}`}
                      className="mt-1"
                    />
                  ) : null}
                  <span>
                    <span className="block text-sm">{task.title}</span>
                    <span className="text-ink-muted block text-xs">{dueDate(task.dueDate)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted mt-3 text-sm">No tasks recorded.</p>
        )}
      </section>

      <section className="border-line border p-5">
        <h2 className="font-medium">Deliverables ({project.deliverables.length})</h2>
        {project.deliverables.length ? (
          <ul className="mt-4 space-y-4">
            {project.deliverables.map((deliverable) => (
              <li
                key={deliverable.id}
                className="border-line border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{deliverable.title}</p>
                    <p className="text-ink-muted text-xs">{dueDate(deliverable.dueDate)}</p>
                  </div>
                  {project.archived ? (
                    <span className="text-ink-muted text-xs">{deliverable.status}</span>
                  ) : (
                    <select
                      aria-label={`Status for ${deliverable.title}`}
                      value={deliverable.status}
                      disabled={pending}
                      onChange={(event) =>
                        run(() => setProjectDeliverableStatus(deliverable.id, event.target.value))
                      }
                      className="border-line-strong h-8 border bg-white px-2 text-xs"
                    >
                      {DELIVERABLE_STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted mt-3 text-sm">No deliverables recorded.</p>
        )}
      </section>

      <p aria-live="polite" className="text-sm xl:col-span-3">
        {message}
      </p>
    </div>
  );
}
