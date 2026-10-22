import type { ClientListItem } from "@/features/clients/list-view-model";
import type { EnquiryListItem } from "@/features/enquiries/list-view-model";
import type { FollowUpListItem } from "@/features/follow-ups/types";
import type { InvoiceListItem, QuoteListItem } from "@/features/invoices/types";
import type { ProjectListItem } from "@/features/projects/types";

export type DashboardActivityRecord = {
  id: string;
  collection: string | null;
  recordId: string | null;
  message: string;
  action: string | null;
  createdAt: string;
};

export type DashboardSourceData = {
  enquiries: EnquiryListItem[];
  projects: ProjectListItem[];
  clients: ClientListItem[];
  followUps: FollowUpListItem[];
  invoices: InvoiceListItem[];
  quotes: QuoteListItem[];
  communicationCount: number;
  activity: DashboardActivityRecord[];
};

export type AttentionKind = "Enquiry" | "Quote" | "Invoice" | "Follow-up" | "Project";

export type DashboardAttentionItem = {
  id: string;
  kind: AttentionKind;
  clientName: string;
  service: string;
  currentStage: string;
  nextAction: string;
  dueLabel: string;
  status: string;
  href: string;
  urgency: number;
  dueSort: string;
};

export type DashboardPipelineItem = { label: string; value: number; href: string };

export type DashboardActiveRecord = {
  id: string;
  clientName: string;
  projectName: string;
  href: string;
  enquiryDate: string;
  services: string;
  attachments: number;
  quoteStatus: string;
  bookingStatus: string;
  paymentStatus: string;
  projectStatus: string;
  nextFollowUp: string;
  notes: string;
};

export type DashboardFollowUpItem = {
  id: string;
  clientName: string;
  title: string;
  date: string;
  dateLabel: string;
  dueLabel: string;
  href: string;
};

export type DashboardActivityItem = DashboardActivityRecord & {
  relativeTime: string;
  href: string | null;
};

export type DashboardViewModel = {
  dateLabel: string;
  metrics: {
    newEnquiries: number;
    activeProjects: number;
    dueFollowUps: number;
    overdueFollowUps: number;
    outstandingInvoices: number;
    outstandingTotal: number;
  };
  attention: DashboardAttentionItem[];
  attentionTotal: number;
  pipeline: DashboardPipelineItem[];
  activeRecord: DashboardActiveRecord | null;
  upcomingFollowUps: DashboardFollowUpItem[];
  activity: DashboardActivityItem[];
};
