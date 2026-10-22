import { describe, expect, it } from "vitest";
import { buildOpsSearchResults } from "@/features/ops-search/search-records";

const sources = {
  clients: [
    {
      id: "client-1",
      name: "Blackridge Hotels",
      status: "Active",
      archived: false,
      primaryContact: { fullName: "James Mitchell", email: "james@blackridge.test" },
    },
    {
      id: "client-2",
      name: "Archived Studio",
      status: "Inactive",
      archived: true,
      primaryContact: null,
    },
  ],
  enquiries: [
    {
      id: "enquiry-1",
      fullName: "Rachel Mokoena",
      company: "Lumen Partners",
      email: "rachel@lumen.test",
      projectType: "Brand Film",
      status: "Reviewing",
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "Autumn Resort Campaign",
      clientName: "Blackridge Hotels",
      projectType: "Commercial Photography",
      status: "Planning",
      archived: false,
    },
  ],
  invoices: [
    {
      id: "invoice-1",
      reference: "INV-2084",
      clientName: "Blackridge Hotels",
      projectName: "Autumn Resort Campaign",
      title: "Photography deposit",
      displayStatus: "Overdue",
    },
  ],
  followUps: [
    {
      id: "follow-up-1",
      reference: "FUP-0312",
      clientName: "Blackridge Hotels",
      title: "Confirm client approval",
      displayType: "Quote Follow-up",
      status: "Open",
    },
  ],
};

describe("buildOpsSearchResults", () => {
  it("returns grouped live-record links from matching business fields", () => {
    expect(buildOpsSearchResults("blackridge", sources)).toEqual([
      expect.objectContaining({ kind: "Client", href: "/ops/clients/client-1" }),
      expect.objectContaining({ kind: "Project", href: "/ops/projects/project-1" }),
      expect.objectContaining({ kind: "Invoice", href: "/ops/invoices/invoice-1" }),
      expect.objectContaining({ kind: "Follow-up", href: "/ops/follow-ups/follow-up-1" }),
    ]);
  });

  it("searches contacts and references while excluding archived records", () => {
    expect(buildOpsSearchResults("james@blackridge", sources)).toEqual([
      expect.objectContaining({ kind: "Client", title: "Blackridge Hotels" }),
    ]);
    expect(buildOpsSearchResults("INV-2084", sources)).toEqual([
      expect.objectContaining({ kind: "Invoice", title: "INV-2084" }),
    ]);
    expect(buildOpsSearchResults("Archived Studio", sources)).toEqual([]);
  });

  it("does not search until at least two characters are supplied", () => {
    expect(buildOpsSearchResults("b", sources)).toEqual([]);
  });
});
