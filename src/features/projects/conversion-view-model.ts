import type { ProjectClientOption, ProjectInput, ProjectType } from "@/features/projects/types";
import { PROJECT_TYPES } from "@/features/projects/types";

export type EnquiryConversionSource = {
  id: string;
  clientId: string;
  fullName: string;
  projectType: string;
  location: string;
  timeline: string;
  description: string;
  budget: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function buildConversionDefaults(
  source: EnquiryConversionSource,
  client: ProjectClientOption,
): { values: ProjectInput; sourceTimeline: string; sourceBudget: string } {
  const projectType = PROJECT_TYPES.includes(source.projectType as ProjectType)
    ? (source.projectType as ProjectType)
    : "Other";
  const parsedDate = ISO_DATE.test(source.timeline.trim()) ? source.timeline.trim() : "";
  return {
    values: {
      name: `${projectType} - ${client.name || source.fullName}`,
      clientId: source.clientId,
      clientContactId:
        client.contacts.find((contact) => contact.isPrimary)?.id ?? client.contacts[0]?.id ?? "",
      projectType,
      services: [],
      overview: source.description,
      location: source.location,
      startDate: parsedDate,
      endDate: parsedDate,
      scheduleNotes: parsedDate ? "" : source.timeline,
      peopleResources: "",
      budgetMin: "",
      budgetMax: "",
      currency: "ZAR",
      paymentStatus: "Not Invoiced",
      deliveryStatus: "Not Ready",
      status: "Planning",
      milestones: [],
      tasks: [],
      deliverables: [],
    },
    sourceTimeline: source.timeline,
    sourceBudget: source.budget,
  };
}
