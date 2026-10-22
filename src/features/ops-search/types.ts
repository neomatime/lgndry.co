export type OpsSearchKind = "Client" | "Enquiry" | "Project" | "Invoice" | "Follow-up";

export type OpsSearchResult = {
  id: string;
  kind: OpsSearchKind;
  title: string;
  subtitle: string;
  status: string;
  href: string;
};

export type OpsSearchResponse = { results: OpsSearchResult[] };
