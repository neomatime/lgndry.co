import type { OpsSearchResult } from "@/features/ops-search/types";

type SearchSources = {
  clients: {
    id: string;
    name: string;
    status: string;
    archived: boolean;
    primaryContact: { fullName: string; email: string } | null;
  }[];
  enquiries: {
    id: string;
    fullName: string;
    company: string | null;
    email: string;
    projectType: string;
    status: string;
  }[];
  projects: {
    id: string;
    name: string;
    clientName: string;
    projectType: string;
    status: string;
    archived: boolean;
  }[];
  invoices: {
    id: string;
    reference: string;
    clientName: string;
    projectName: string | null;
    title: string;
    displayStatus: string;
  }[];
  followUps: {
    id: string;
    reference: string;
    clientName: string;
    title: string;
    displayType: string;
    status: string;
  }[];
};

function matches(query: string, ...values: Array<string | null | undefined>) {
  return values.some((value) => value?.toLocaleLowerCase().includes(query));
}

export function buildOpsSearchResults(query: string, sources: SearchSources) {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length < 2) return [];

  const results: OpsSearchResult[] = [];

  results.push(
    ...sources.clients
      .filter(
        (client) =>
          !client.archived &&
          matches(
            normalized,
            client.name,
            client.primaryContact?.fullName,
            client.primaryContact?.email,
          ),
      )
      .slice(0, 5)
      .map((client) => ({
        id: client.id,
        kind: "Client" as const,
        title: client.name,
        subtitle: client.primaryContact?.fullName ?? "Client record",
        status: client.status,
        href: `/ops/clients/${client.id}`,
      })),
  );

  results.push(
    ...sources.enquiries
      .filter((enquiry) =>
        matches(normalized, enquiry.fullName, enquiry.company, enquiry.email, enquiry.projectType),
      )
      .slice(0, 5)
      .map((enquiry) => ({
        id: enquiry.id,
        kind: "Enquiry" as const,
        title: enquiry.company || enquiry.fullName,
        subtitle: `${enquiry.projectType} · ${enquiry.fullName}`,
        status: enquiry.status,
        href: `/ops/enquiries/${enquiry.id}`,
      })),
  );

  results.push(
    ...sources.projects
      .filter(
        (project) =>
          !project.archived &&
          matches(normalized, project.name, project.clientName, project.projectType),
      )
      .slice(0, 5)
      .map((project) => ({
        id: project.id,
        kind: "Project" as const,
        title: project.name,
        subtitle: `${project.clientName} · ${project.projectType}`,
        status: project.status,
        href: `/ops/projects/${project.id}`,
      })),
  );

  results.push(
    ...sources.invoices
      .filter((invoice) =>
        matches(
          normalized,
          invoice.reference,
          invoice.clientName,
          invoice.projectName,
          invoice.title,
        ),
      )
      .slice(0, 5)
      .map((invoice) => ({
        id: invoice.id,
        kind: "Invoice" as const,
        title: invoice.reference,
        subtitle: `${invoice.clientName} · ${invoice.title}`,
        status: invoice.displayStatus,
        href: `/ops/invoices/${invoice.id}`,
      })),
  );

  results.push(
    ...sources.followUps
      .filter((followUp) =>
        matches(
          normalized,
          followUp.reference,
          followUp.clientName,
          followUp.title,
          followUp.displayType,
        ),
      )
      .slice(0, 5)
      .map((followUp) => ({
        id: followUp.id,
        kind: "Follow-up" as const,
        title: followUp.title,
        subtitle: `${followUp.clientName} · ${followUp.displayType}`,
        status: followUp.status,
        href: `/ops/follow-ups/${followUp.id}`,
      })),
  );

  return results;
}
