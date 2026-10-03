import {
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  ListChecks,
  Pencil,
  Send,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { RelatedFollowUps } from "@/features/follow-ups/components/related-follow-ups";
import { relatedAddAvailability } from "@/features/follow-ups/related-view-model";
import { ProjectArchiveControl } from "@/features/projects/components/project-archive-control";
import {
  DeliveryStatusBadge,
  PaymentStatusBadge,
  ProjectStatusBadge,
} from "@/features/projects/components/project-badges";
import { ProjectPlan } from "@/features/projects/components/project-plan";
import { ProjectStageControl } from "@/features/projects/components/project-stage-control";
import { buildProjectDetailSummary } from "@/features/projects/detail-view-model";
import type { ProjectDetail } from "@/features/projects/types";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeZone: "Africa/Johannesburg",
});

function localDate(value: string) {
  return value ? dateFormatter.format(new Date(`${value}T12:00:00Z`)) : "Not scheduled";
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line border p-5">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ProjectDetailView({ project }: { project: ProjectDetail }) {
  const summary = buildProjectDetailSummary(project);
  const money = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: project.currency,
    maximumFractionDigits: 0,
  });
  const budget = summary.budget
    ? [summary.budget.minimum, summary.budget.maximum]
        .filter((value): value is number => value !== null)
        .map((value) => money.format(value))
        .join(" - ")
    : "Not recorded";

  const followUpAdd = relatedAddAvailability("project", {
    archived: project.archived,
    clientId: project.clientId,
    clientArchived: project.clientArchived,
  });
  const followUps = (
    <RelatedFollowUps
      related={project.followUps}
      subject="project"
      add={{ clientId: project.clientId, projectId: project.id }}
      canAdd={followUpAdd.canAdd}
      addBlockedReason={followUpAdd.canAdd ? undefined : followUpAdd.reason}
    />
  );

  const overview = (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Project Overview">
        <p className="text-ink-muted text-sm whitespace-pre-line">
          {project.overview || "No project overview recorded yet."}
        </p>
      </Panel>
      <Panel title="Scope / Services">
        {project.services.length ? (
          <ul className="flex flex-wrap gap-2">
            {project.services.map((service) => (
              <li key={service} className="bg-line px-3 py-1.5 text-xs font-medium">
                {service}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted text-sm">No services recorded.</p>
        )}
      </Panel>
      <Panel title="Schedule">
        <dl className="text-ink-muted space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Start</dt>
            <dd className="text-ink">{localDate(project.startDate)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>End</dt>
            <dd className="text-ink">{localDate(project.endDate)}</dd>
          </div>
          <div>
            <dt>Schedule notes</dt>
            <dd className="text-ink mt-1 whitespace-pre-line">
              {project.scheduleNotes || "No schedule notes recorded."}
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel title="People / Resources">
        <p className="text-ink-muted text-sm whitespace-pre-line">
          {project.peopleResources || "No people or resources recorded."}
        </p>
      </Panel>
      {project.booking ? (
        <Panel title="Legacy Booking Snapshot">
          <dl className="text-ink-muted space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Date</dt>
              <dd className="text-ink">{localDate(project.booking.date ?? "")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Location</dt>
              <dd className="text-ink text-right">{project.booking.location || "Not recorded"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd className="text-ink">{project.booking.status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Deposit</dt>
              <dd className="text-ink">{project.booking.deposit}</dd>
            </div>
          </dl>
        </Panel>
      ) : null}
    </div>
  );

  const activity = project.activity.length ? (
    <ol className="border-line divide-line divide-y border">
      {project.activity.map((entry) => (
        <li key={entry.id} className="p-4 text-sm">
          <p>{entry.message}</p>
          <p className="text-ink-muted mt-1 text-xs">{entry.relativeTime}</p>
        </li>
      ))}
    </ol>
  ) : (
    <p className="text-ink-muted py-8 text-sm">No project activity recorded yet.</p>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="text-ink-muted flex items-center gap-1 text-sm">
        <Link href="/ops/projects" className="hover:text-ink underline">
          Projects
        </Link>
        <span>/</span>
        <span>{project.name}</span>
      </div>

      <PageHeader
        title={project.name}
        description={project.clientName}
        actions={
          <div className="flex flex-wrap items-start justify-end gap-2">
            <Link
              href="/ops/projects"
              className="border-line-strong text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center gap-2 border bg-white px-4 text-sm font-medium transition-colors"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Back to Projects
            </Link>
            {!project.archived ? (
              <>
                <Link
                  href={`/ops/projects/${project.id}/edit`}
                  className="border-line-strong text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center gap-2 border bg-white px-4 text-sm font-medium transition-colors"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit Project
                </Link>
                <ProjectStageControl
                  projectId={project.id}
                  status={project.status}
                  stagePosition={project.stagePosition}
                />
              </>
            ) : null}
            <ProjectArchiveControl
              projectId={project.id}
              projectName={project.name}
              archived={project.archived}
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={ListChecks}
          label="Current Stage"
          value={<ProjectStatusBadge status={project.status} />}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Payment"
          value={<PaymentStatusBadge status={project.paymentStatus} />}
        />
        <StatCard icon={CalendarDays} label="Timeline" value={summary.dateRange} />
        <StatCard icon={CircleDollarSign} label="Budget" value={budget} />
        <StatCard
          icon={Send}
          label="Delivered"
          value={`${summary.progress.completed} / ${summary.progress.total}`}
        />
      </div>

      {project.archived ? (
        <p className="border-line-strong border px-4 py-3 text-sm">
          This project is archived. Restore it to edit the profile, change stages, or update its
          plan.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_320px]">
        <Tabs
          items={[
            { id: "overview", label: "Overview", content: overview },
            { id: "plan", label: "Plan", content: <ProjectPlan project={project} /> },
            {
              id: "follow-ups",
              label: `Follow-ups (${project.followUps.total})`,
              content: followUps,
            },
            { id: "activity", label: "Activity", content: activity },
          ]}
        />

        <aside className="flex flex-col gap-6">
          <Panel title="Project Details">
            <dl className="text-ink-muted space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Project ID</dt>
                <dd className="text-ink">{project.id.slice(0, 8).toUpperCase()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Client</dt>
                <dd>
                  <Link href={`/ops/clients/${project.clientId}`} className="text-ink underline">
                    {project.clientName}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Contact</dt>
                <dd className="text-ink text-right">
                  {project.contact?.fullName ?? "Not assigned"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Type</dt>
                <dd className="text-ink">{project.projectType}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Location</dt>
                <dd className="text-ink text-right">{project.location || "Not recorded"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Delivery</dt>
                <dd>
                  <DeliveryStatusBadge status={project.deliveryStatus} />
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Next Actions">
            {project.tasks.filter((task) => !task.isCompleted).length ? (
              <ul className="space-y-3 text-sm">
                {project.tasks
                  .filter((task) => !task.isCompleted)
                  .slice(0, 4)
                  .map((task) => (
                    <li key={task.id} className="flex justify-between gap-3">
                      <span>{task.title}</span>
                      <span className="text-ink-muted shrink-0 text-xs">
                        {task.dueDate ? localDate(task.dueDate) : "No date"}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-ink-muted text-sm">No pending tasks.</p>
            )}
          </Panel>

          <Panel title="Progress / Finance">
            <dl className="text-ink-muted space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Deliverables</dt>
                <dd className="text-ink">{summary.progress.percent}%</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Budget</dt>
                <dd className="text-ink text-right">{budget}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Payment</dt>
                <dd>
                  <PaymentStatusBadge status={project.paymentStatus} />
                </dd>
              </div>
            </dl>
          </Panel>

          {project.enquiry || project.bookingId ? (
            <Panel title="Linked Records">
              <div className="flex flex-col gap-2 text-sm">
                {project.enquiry ? (
                  <Link href={`/ops/enquiries/${project.enquiry.id}`} className="underline">
                    Source enquiry · {project.enquiry.projectType}
                  </Link>
                ) : null}
                {project.bookingId ? (
                  <p className="text-ink-muted">
                    Legacy booking · {project.bookingId.slice(0, 8).toUpperCase()}
                  </p>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
