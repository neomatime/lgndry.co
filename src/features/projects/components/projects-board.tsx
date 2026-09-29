"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { moveProject } from "@/features/projects/actions";
import { ProjectCard } from "@/features/projects/components/project-card";
import { ProjectPreview } from "@/features/projects/components/project-preview";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import {
  buildBoard,
  filterProjects,
  moveProjectOptimistically,
  sortProjects,
  type ProjectFilters,
  type ProjectSort,
  type ProjectView,
} from "@/features/projects/list-view-model";
import {
  ACTIVE_PROJECT_STAGES,
  DELIVERY_STATUSES,
  PAYMENT_STATUSES,
  PROJECT_TYPES,
  type ActiveProjectStage,
  type ProjectListItem,
  type ProjectStatus,
} from "@/features/projects/types";

const VIEWS: ProjectView[] = ["Active", "Completed", "On Hold", "Cancelled", "Archived"];

function BoardColumn({
  stage,
  projects,
  selectedId,
  onSelect,
  onMove,
}: {
  stage: ActiveProjectStage;
  projects: ProjectListItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (projectId: string, status: ProjectStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${stage}` });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage} projects`}
      className={`border-line bg-surface-soft w-[280px] shrink-0 border p-2 ${isOver ? "border-ink" : ""}`}
    >
      <div className="flex h-9 items-center justify-between gap-3 px-1">
        <h3 className="text-sm font-medium">{stage}</h3>
        <span className="bg-line inline-flex min-w-6 justify-center px-2 py-1 text-xs">
          {projects.length}
        </span>
      </div>
      <SortableContext
        items={projects.map((project) => project.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="mt-1 flex min-h-20 flex-col gap-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              selected={selectedId === project.id}
              onSelect={(checked) => onSelect(checked ? project.id : null)}
              onMove={(status) => onMove(project.id, status)}
            />
          ))}
          {projects.length === 0 ? (
            <p className="text-ink-muted border-line border border-dashed px-3 py-8 text-center text-xs">
              No projects
            </p>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

function countView(rows: ProjectListItem[], view: ProjectView) {
  return filterProjects(rows, { view, search: "" }).length;
}

export function ProjectsBoard({ rows }: { rows: ProjectListItem[] }) {
  const [projects, setProjects] = useState(rows);
  const [view, setView] = useState<ProjectView>("Active");
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectType, setProjectType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [sort, setSort] = useState<ProjectSort>("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const clients = useMemo(
    () =>
      [
        ...new Map(projects.map((project) => [project.clientId, project.clientName])).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [projects],
  );
  const filters = useMemo<ProjectFilters>(
    () => ({
      view,
      search,
      clientId: clientId || undefined,
      projectType: projectType ? (projectType as ProjectFilters["projectType"]) : undefined,
      paymentStatus: paymentStatus ? (paymentStatus as ProjectFilters["paymentStatus"]) : undefined,
      deliveryStatus: deliveryStatus
        ? (deliveryStatus as ProjectFilters["deliveryStatus"])
        : undefined,
    }),
    [view, search, clientId, projectType, paymentStatus, deliveryStatus],
  );
  const filtered = useMemo(() => filterProjects(projects, filters), [projects, filters]);
  const fullBoard = useMemo(() => buildBoard(projects), [projects]);
  const board = useMemo(() => buildBoard(filtered), [filtered]);
  const terminalRows = useMemo(() => sortProjects(filtered, sort), [filtered, sort]);
  const selected = projects.find((project) => project.id === selectedId) ?? null;

  async function persistMove(
    projectId: string,
    destination: ProjectStatus,
    destinationIndex: number,
  ) {
    const previous = projects;
    const sourceBoard = buildBoard(projects);
    const isActiveDestination = ACTIVE_PROJECT_STAGES.includes(destination as ActiveProjectStage);
    let next = projects;

    if (isActiveDestination) {
      const moved = moveProjectOptimistically(
        sourceBoard,
        projectId,
        destination as ActiveProjectStage,
        destinationIndex,
      );
      const changed = new Map(
        ACTIVE_PROJECT_STAGES.flatMap((stage) =>
          moved[stage].map((project) => [project.id, project] as const),
        ),
      );
      next = projects.map((project) => changed.get(project.id) ?? project);
    } else {
      next = projects.map((project) =>
        project.id === projectId ? { ...project, status: destination, stagePosition: 0 } : project,
      );
    }

    setProjects(next);
    setMessage("");
    const result = await moveProject(projectId, destination, destinationIndex);
    if (result.status !== "success") {
      setProjects(previous);
      setMessage("message" in result ? result.message : "The project stage could not be updated.");
      return;
    }
    setMessage("Project stage updated.");
  }

  function handleDragEnd(event: DragEndEvent) {
    const projectId = String(event.active.id);
    if (!event.over) return;
    const overId = String(event.over.id);
    const destination = overId.startsWith("column:")
      ? (overId.slice(7) as ActiveProjectStage)
      : projects.find((project) => project.id === overId)?.status;
    if (!destination || !ACTIVE_PROJECT_STAGES.includes(destination as ActiveProjectStage)) return;
    const destinationIndex = overId.startsWith("column:")
      ? fullBoard[destination as ActiveProjectStage].length
      : Math.max(
          0,
          fullBoard[destination as ActiveProjectStage].findIndex(
            (project) => project.id === overId,
          ),
        );
    void persistMove(projectId, destination, destinationIndex);
  }

  function changeView(next: ProjectView) {
    setView(next);
    setSelectedId(null);
    setMessage("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-line flex flex-col gap-3 border-b xl:flex-row xl:items-end xl:justify-between">
        <div role="tablist" aria-label="Project views" className="flex gap-1 overflow-x-auto">
          {VIEWS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => changeView(value)}
              className={
                view === value
                  ? "border-ink text-ink shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap"
                  : "text-ink-muted hover:text-ink shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap"
              }
            >
              {value} ({countView(projects, value)})
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 pb-3 xl:justify-end xl:pb-2">
          <label className="border-line-strong flex h-9 min-w-52 flex-1 items-center gap-2 border px-3 xl:flex-none">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Search projects</span>
            <input
              type="search"
              placeholder="Search projects..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none xl:w-44"
            />
          </label>
          <select
            aria-label="Filter by client"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="border-line-strong h-9 border px-2 text-sm"
          >
            <option value="">All clients</option>
            {clients.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by project type"
            value={projectType}
            onChange={(event) => setProjectType(event.target.value)}
            className="border-line-strong h-9 border px-2 text-sm"
          >
            <option value="">All types</option>
            {PROJECT_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <select
            aria-label="Filter by payment status"
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
            className="border-line-strong h-9 border px-2 text-sm"
          >
            <option value="">All payments</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select
            aria-label="Filter by delivery status"
            value={deliveryStatus}
            onChange={(event) => setDeliveryStatus(event.target.value)}
            className="border-line-strong h-9 border px-2 text-sm"
          >
            <option value="">All delivery</option>
            {DELIVERY_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          {view !== "Active" ? (
            <select
              aria-label="Sort projects"
              value={sort}
              onChange={(event) => setSort(event.target.value as ProjectSort)}
              className="border-line-strong h-9 border px-2 text-sm"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="start-date">Start date</option>
              <option value="name">Name</option>
            </select>
          ) : null}
        </div>
      </div>

      <p aria-live="polite" className="text-ink-muted min-h-5 text-sm">
        {message}
      </p>

      {filtered.length === 0 ? (
        <p className="text-ink-muted py-14 text-center text-sm">No projects match this view.</p>
      ) : view === "Active" ? (
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex min-w-0 snap-x gap-3 overflow-x-auto pb-4">
              {ACTIVE_PROJECT_STAGES.map((stage) => (
                <BoardColumn
                  key={stage}
                  stage={stage}
                  projects={board[stage]}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onMove={(projectId, status) =>
                    void persistMove(
                      projectId,
                      status,
                      ACTIVE_PROJECT_STAGES.includes(status as ActiveProjectStage)
                        ? fullBoard[status as ActiveProjectStage].length
                        : 0,
                    )
                  }
                />
              ))}
            </div>
          </DndContext>
          {selected ? <ProjectPreview project={selected} /> : null}
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            <ProjectsTable rows={terminalRows} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          {selected ? <ProjectPreview project={selected} /> : null}
        </div>
      )}
    </div>
  );
}
