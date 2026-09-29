import { CheckSquare2 } from "lucide-react";
import Link from "next/link";
import {
  DeliveryStatusBadge,
  PaymentStatusBadge,
  ProjectStatusBadge,
} from "@/features/projects/components/project-badges";
import { getDeliverableProgress, getNextAction } from "@/features/projects/list-view-model";
import type { ProjectListItem } from "@/features/projects/types";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeZone: "Africa/Johannesburg",
});

export function ProjectPreview({ project }: { project: ProjectListItem }) {
  const nextAction = getNextAction(project);
  const progress = getDeliverableProgress(project);

  return (
    <aside aria-label={`${project.name} preview`} className="border-line border p-5 xl:w-80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-medium">{project.name}</p>
          <p className="text-ink-muted text-sm">{project.clientName}</p>
        </div>
        <Link
          href={`/ops/projects/${project.id}`}
          className="shrink-0 text-sm font-medium underline"
        >
          Open
        </Link>
      </div>

      <dl className="border-line mt-5 space-y-3 border-t pt-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Stage</dt>
          <dd>
            <ProjectStatusBadge status={project.status} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Payment</dt>
          <dd>
            <PaymentStatusBadge status={project.paymentStatus} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Delivery</dt>
          <dd>
            <DeliveryStatusBadge status={project.deliveryStatus} />
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-ink-muted">Contact</dt>
          <dd className="text-right">{project.contact?.fullName ?? "Not assigned"}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-ink-muted">Starts</dt>
          <dd>
            {project.startDate
              ? dateFormatter.format(new Date(`${project.startDate}T12:00:00Z`))
              : "Not scheduled"}
          </dd>
        </div>
      </dl>

      <section className="border-line mt-5 border-t pt-4">
        <h3 className="text-sm font-medium">Overview</h3>
        <p className="text-ink-muted mt-2 text-sm">
          {project.overview || "No project overview has been added."}
        </p>
      </section>

      <section className="border-line mt-5 border-t pt-4">
        <h3 className="text-sm font-medium">Next Action</h3>
        <div className="mt-2 flex items-start gap-2 text-sm">
          <CheckSquare2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p>{nextAction?.title ?? "No pending task"}</p>
            {nextAction?.dueDate ? (
              <p className="text-ink-muted text-xs">
                Due {dateFormatter.format(new Date(`${nextAction.dueDate}T12:00:00Z`))}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-line mt-5 border-t pt-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <h3 className="font-medium">Deliverables</h3>
          <span className="text-ink-muted">
            {progress.completed}/{progress.total}
          </span>
        </div>
        <div className="bg-line mt-2 h-1.5 overflow-hidden" aria-hidden="true">
          <div className="bg-ink h-full" style={{ width: `${progress.percent}%` }} />
        </div>
      </section>

      {project.activity.length ? (
        <section className="border-line mt-5 border-t pt-4">
          <h3 className="text-sm font-medium">Recent Activity</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {project.activity.slice(0, 3).map((entry) => (
              <li key={entry.id}>
                <p>{entry.message}</p>
                <p className="text-ink-muted text-xs">{entry.relativeTime}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
