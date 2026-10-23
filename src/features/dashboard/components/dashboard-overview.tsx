"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderKanban,
  Mail,
  MessageSquare,
  MoreVertical,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { OpsPanel, OpsPanelHeader } from "@/components/ops/ops-panel";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type {
  AttentionKind,
  DashboardActiveRecord,
  DashboardActivityItem,
  DashboardAttentionItem,
  DashboardFollowUpItem,
  DashboardPipelineItem,
  DashboardViewModel,
} from "@/features/dashboard/types";
import { formatDashboardMoney } from "@/features/dashboard/view-model";

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function PanelHeader({ title, count, href }: { title: string; count?: number; href?: string }) {
  return (
    <OpsPanelHeader>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {title}
        {count !== undefined ? (
          <span className="bg-surface-soft inline-flex min-w-6 justify-center rounded-full px-2 py-0.5 text-xs font-medium">
            {count}
          </span>
        ) : null}
      </h2>
      {href ? (
        <Link
          href={href}
          className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-xs"
        >
          View all <ChevronRight className="size-3" aria-hidden="true" />
        </Link>
      ) : null}
    </OpsPanelHeader>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      title={`Open ${label}`}
      className="border-line hover:border-line-strong group flex min-h-24 items-center gap-4 rounded-[var(--ops-radius)] border bg-white p-4 shadow-[var(--ops-shadow-resting)] transition-[border-color,box-shadow,transform] duration-[var(--ops-motion-fast)] hover:-translate-y-0.5 hover:shadow-[var(--ops-shadow-raised)]"
    >
      <span className="bg-surface-soft flex size-11 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-semibold">
            {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
          </span>
          <span className="text-ink-muted text-xs">{detail}</span>
        </span>
      </span>
      <ChevronRight
        className="text-ink-muted size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

const ATTENTION_ICONS: Record<AttentionKind, LucideIcon> = {
  Enquiry: Mail,
  Quote: FileText,
  Invoice: FileText,
  "Follow-up": CalendarDays,
  Project: FolderKanban,
};

function AttentionRow({ item }: { item: DashboardAttentionItem }) {
  const Icon = ATTENTION_ICONS[item.kind];
  return (
    <Link
      href={item.href}
      className="border-line hover:bg-surface-soft grid gap-3 border-t px-4 py-3 text-sm transition-colors xl:grid-cols-[minmax(11rem,1.25fr)_minmax(8rem,.7fr)_minmax(8rem,.75fr)_minmax(12rem,1.5fr)_6rem_8.5rem_1rem] xl:items-center"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="bg-surface-soft flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium">
          {initials(item.clientName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{item.clientName}</span>
          <span className="text-ink-muted block truncate text-xs">{item.service}</span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-ink-muted xl:hidden">Type:</span>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {item.kind}
      </span>
      <span className="text-ink-muted">
        <span className="mr-2 xl:hidden">Stage:</span>
        {item.currentStage}
      </span>
      <span className="min-w-0 break-words">
        <span className="text-ink-muted mr-2 xl:hidden">Next:</span>
        {item.nextAction}
      </span>
      <span className={item.dueLabel === "Overdue" ? "font-semibold" : ""}>
        <span className="text-ink-muted mr-2 font-normal xl:hidden">Due:</span>
        {item.dueLabel}
      </span>
      <span>
        <span className="text-ink-muted mr-2 xl:hidden">Status:</span>
        <span className="bg-surface-soft inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium">
          {item.status}
        </span>
      </span>
      <MoreVertical className="text-ink-muted hidden size-4 xl:block" aria-hidden="true" />
    </Link>
  );
}

function AttentionQueue({ items }: { items: DashboardAttentionItem[] }) {
  const [query, setQuery] = useState("");
  const [client, setClient] = useState("All clients");
  const [type, setType] = useState("All types");
  const [stage, setStage] = useState("All stages");
  const clients = useMemo(
    () => Array.from(new Set(items.map((item) => item.clientName))).sort(),
    [items],
  );
  const types = useMemo(() => Array.from(new Set(items.map((item) => item.kind))).sort(), [items]);
  const stages = useMemo(
    () => Array.from(new Set(items.map((item) => item.currentStage))).sort(),
    [items],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter(
      (item) =>
        (client === "All clients" || item.clientName === client) &&
        (type === "All types" || item.kind === type) &&
        (stage === "All stages" || item.currentStage === stage) &&
        (!normalized ||
          [item.clientName, item.service, item.nextAction, item.status].some((value) =>
            value.toLocaleLowerCase().includes(normalized),
          )),
    );
  }, [client, items, query, stage, type]);

  return (
    <OpsPanel>
      <PanelHeader title="Attention Queue" count={filtered.length} />
      <div className="border-line grid gap-2 border-t p-3 sm:grid-cols-2 xl:grid-cols-[minmax(13rem,1fr)_10rem_10rem_10rem]">
        <label className="border-line focus-within:border-line-strong flex h-9 items-center gap-2 rounded-[var(--ops-radius-sm)] border bg-white px-3">
          <Search className="text-ink-muted size-4" aria-hidden="true" />
          <span className="sr-only">Search attention queue</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <label>
          <span className="sr-only">Filter by client</span>
          <select
            value={client}
            onChange={(event) => setClient(event.target.value)}
            className="border-line h-9 w-full rounded-[var(--ops-radius-sm)] border bg-white px-3 text-sm"
          >
            <option>All clients</option>
            {clients.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by item type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="border-line h-9 w-full rounded-[var(--ops-radius-sm)] border bg-white px-3 text-sm"
          >
            <option>All types</option>
            {types.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by stage</span>
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="border-line h-9 w-full rounded-[var(--ops-radius-sm)] border bg-white px-3 text-sm"
          >
            <option>All stages</option>
            {stages.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length ? (
        <>
          <div className="bg-surface-soft text-ink-muted hidden grid-cols-[minmax(11rem,1.25fr)_minmax(8rem,.7fr)_minmax(8rem,.75fr)_minmax(12rem,1.5fr)_6rem_8.5rem_1rem] px-4 py-2 text-[11px] xl:grid">
            <span>Client</span>
            <span>Item Type</span>
            <span>Current Stage</span>
            <span>Next Action</span>
            <span>Due</span>
            <span>Status</span>
            <span />
          </div>
          <div>
            {filtered.map((item) => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </div>
        </>
      ) : (
        <p className="border-line text-ink-muted border-t px-4 py-8 text-center text-sm">
          {items.length
            ? "No queue items match these filters."
            : "Nothing needs immediate attention."}
        </p>
      )}
    </OpsPanel>
  );
}

function EngagementPipeline({ items }: { items: DashboardPipelineItem[] }) {
  return (
    <OpsPanel>
      <PanelHeader title="Engagement Pipeline" />
      <div className="border-line grid grid-cols-2 border-t sm:grid-cols-4 xl:grid-cols-11">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            title={`Open ${item.label} records`}
            className="border-line hover:bg-surface-soft flex min-h-20 flex-col items-center justify-center gap-1 border-r border-b px-2 text-center transition-colors last:border-r-0 xl:border-b-0"
          >
            <span className="bg-surface-soft flex size-9 items-center justify-center rounded-full text-sm font-semibold">
              {item.value}
            </span>
            <span className="text-[11px]">{item.label}</span>
          </Link>
        ))}
      </div>
    </OpsPanel>
  );
}

function Definition({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

function ActiveRecord({ record }: { record: DashboardActiveRecord | null }) {
  return (
    <OpsPanel className="min-w-0 xl:col-span-5">
      <PanelHeader title="Active Record" href={record?.href} />
      {record ? (
        <div className="border-line border-t p-4">
          <div className="flex items-center gap-3">
            <span className="bg-surface-soft flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {initials(record.clientName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{record.clientName}</p>
              <p className="text-ink-muted truncate text-xs">{record.projectName}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <dl className="space-y-2">
              <Definition label="Enquiry Date" value={record.enquiryDate} />
              <Definition label="Services" value={record.services} />
              <Definition label="Attachments" value={`${record.attachments} files`} />
              <Definition label="Quote Status" value={record.quoteStatus} />
              <Definition label="Booking Status" value={record.bookingStatus} />
            </dl>
            <dl className="border-line space-y-2 sm:border-l sm:pl-4">
              <Definition label="Payment Status" value={record.paymentStatus} />
              <Definition label="Project Status" value={record.projectStatus} />
              <Definition label="Next Follow-up" value={record.nextFollowUp} />
              <Definition
                label="Notes"
                value={
                  <span className="line-clamp-3" title={record.notes}>
                    {record.notes}
                  </span>
                }
              />
            </dl>
          </div>
        </div>
      ) : (
        <p className="border-line text-ink-muted border-t px-4 py-8 text-center text-sm">
          No active project yet.
        </p>
      )}
    </OpsPanel>
  );
}

function UpcomingFollowUps({ items }: { items: DashboardFollowUpItem[] }) {
  return (
    <OpsPanel className="min-w-0 xl:col-span-4">
      <PanelHeader title="Upcoming Follow-ups" href="/ops/follow-ups" />
      <div className="border-line border-t px-3">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="border-line hover:bg-surface-soft grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-2.5 last:border-b-0"
            >
              <span className="bg-surface-soft flex h-10 flex-col items-center justify-center text-center leading-none">
                <span className="text-xs font-semibold">{item.date.slice(8, 10)}</span>
                <span className="text-[9px] uppercase">{item.dateLabel.split(" ").at(-1)}</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{item.clientName}</span>
                <span className="text-ink-muted block truncate text-[11px]">{item.title}</span>
              </span>
              <span className="text-ink-muted text-[11px]">{item.dueLabel}</span>
            </Link>
          ))
        ) : (
          <p className="text-ink-muted py-8 text-center text-sm">No upcoming follow-ups.</p>
        )}
      </div>
    </OpsPanel>
  );
}

function ActivityIcon({ collection }: { collection: string | null }) {
  const Icon =
    collection === "email_threads"
      ? MessageSquare
      : collection === "commercial_invoices" || collection === "commercial_quotes"
        ? FileText
        : collection === "projects"
          ? FolderKanban
          : collection === "enquiries"
            ? Mail
            : collection === "follow_ups"
              ? CheckCircle2
              : Activity;
  return <Icon className="size-3.5" aria-hidden="true" />;
}

function ActivityLine({ item }: { item: DashboardActivityItem }) {
  const content = (
    <span className="grid grid-cols-[4.5rem_1rem_minmax(0,1fr)] items-start gap-2 py-2 text-[11px]">
      <span className="text-ink-muted">{item.relativeTime}</span>
      <ActivityIcon collection={item.collection} />
      <span className="break-words">{item.message}</span>
    </span>
  );
  return item.href ? (
    <Link href={item.href} className="hover:bg-surface-soft block">
      {content}
    </Link>
  ) : (
    content
  );
}

function RecentActivity({ items }: { items: DashboardActivityItem[] }) {
  return (
    <OpsPanel className="min-w-0 xl:col-span-3">
      <PanelHeader title="Recent Activity" />
      <div className="border-line relative border-t px-3">
        {items.length ? (
          items.map((item) => <ActivityLine key={item.id} item={item} />)
        ) : (
          <p className="text-ink-muted py-8 text-center text-sm">No recent activity.</p>
        )}
      </div>
    </OpsPanel>
  );
}

export function DashboardOverview({
  dashboard,
  greeting,
}: {
  dashboard: DashboardViewModel;
  greeting: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>
          <p className="text-ink-muted mt-1.5 text-sm">
            Attention-led internal operations for enquiries, projects, follow-ups and payment
            status.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>{dashboard.dateLabel}</span>
          <span className="border-line-strong inline-flex h-9 items-center gap-2 border px-3">
            <CalendarDays className="size-4" aria-hidden="true" />
            Live overview
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Mail}
          label="New Enquiries"
          value={dashboard.metrics.newEnquiries}
          detail="Awaiting first action"
          href="/ops/enquiries"
        />
        <MetricCard
          icon={FolderKanban}
          label="Active Projects"
          value={dashboard.metrics.activeProjects}
          detail="Across the production pipeline"
          href="/ops/projects"
        />
        <MetricCard
          icon={CalendarDays}
          label="Due Follow-ups"
          value={dashboard.metrics.dueFollowUps}
          detail={`${dashboard.metrics.overdueFollowUps} overdue`}
          href="/ops/follow-ups"
        />
        <MetricCard
          icon={FileText}
          label="Outstanding Invoices"
          value={dashboard.metrics.outstandingInvoices}
          detail={`${formatDashboardMoney(dashboard.metrics.outstandingTotal)} total`}
          href="/ops/invoices"
        />
      </div>

      <AttentionQueue items={dashboard.attention} />
      <EngagementPipeline items={dashboard.pipeline} />
      <div className="grid min-w-0 gap-3 xl:grid-cols-12">
        <ActiveRecord record={dashboard.activeRecord} />
        <UpcomingFollowUps items={dashboard.upcomingFollowUps} />
        <RecentActivity items={dashboard.activity} />
      </div>
    </div>
  );
}
