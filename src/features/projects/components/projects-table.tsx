"use client";

import Link from "next/link";
import {
  PaymentStatusBadge,
  ProjectStatusBadge,
} from "@/features/projects/components/project-badges";
import type { ProjectListItem } from "@/features/projects/types";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeZone: "Africa/Johannesburg",
});

export function ProjectsTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: ProjectListItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="scrollbar-hidden overflow-x-auto">
      <table className="min-w-[840px] border-collapse text-sm">
        <thead>
          <tr className="border-line border-b text-left">
            <th className="w-10 py-2" />
            <th className="py-2 pr-4">Project</th>
            <th className="py-2 pr-4">Client</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Start Date</th>
            <th className="py-2 pr-4">Payment</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((project) => (
            <tr key={project.id} className="border-line hover:bg-surface-soft border-b">
              <td className="py-3">
                <input
                  type="checkbox"
                  checked={selectedId === project.id}
                  onChange={(event) => onSelect(event.target.checked ? project.id : null)}
                  aria-label={`Preview ${project.name}`}
                />
              </td>
              <td className="py-3 pr-4">
                <Link href={`/ops/projects/${project.id}`} className="font-medium hover:underline">
                  {project.name}
                </Link>
              </td>
              <td className="py-3 pr-4">{project.clientName}</td>
              <td className="py-3 pr-4">{project.projectType}</td>
              <td className="py-3 pr-4">
                {project.startDate
                  ? dateFormatter.format(new Date(`${project.startDate}T12:00:00Z`))
                  : "Not scheduled"}
              </td>
              <td className="py-3 pr-4">
                <PaymentStatusBadge status={project.paymentStatus} />
              </td>
              <td className="py-3">
                <ProjectStatusBadge status={project.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
