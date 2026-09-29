import { describe, expect, it } from "vitest";
import {
  buildClientListItems,
  computeClientStats,
  filterClients,
  sortClients,
  type ClientListRecord,
} from "@/features/clients/list-view-model";

const record: ClientListRecord = {
  id: "a",
  name: "Blackridge Hotels",
  type: "Company",
  status: "Active",
  account_tier: "Key Account",
  industry: "Hospitality",
  region: "Gauteng",
  client_since: "2025-01-01",
  account_overview: "Overview",
  preferred_services: ["Photography"],
  relationship_notes: "Notes",
  archived: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  client_contacts: [
    {
      id: "c1",
      full_name: "Primary",
      role_title: "CMO",
      email: "p@test.com",
      phone: null,
      is_primary: true,
    },
    {
      id: "c2",
      full_name: "Secondary",
      role_title: null,
      email: "s@test.com",
      phone: null,
      is_primary: false,
    },
  ],
  enquiries: [
    { id: "e1", status: "New", created_at: "2026-01-03T00:00:00Z" },
    { id: "e2", status: "Closed", created_at: "2026-01-04T00:00:00Z" },
  ],
};

describe("client list view model", () => {
  const rows = buildClientListItems([record], new Map([["a", "2026-01-05T00:00:00Z"]]));

  it("shapes contacts, enquiries, and latest activity", () => {
    expect(rows[0]).toMatchObject({ openEnquiryCount: 1, lastActivityAt: "2026-01-05T00:00:00Z" });
    expect(rows[0]?.primaryContact?.fullName).toBe("Primary");
  });

  it("computes approved stats and zeroes", () => {
    expect(computeClientStats(rows)).toEqual({
      active: 1,
      keyAccounts: 1,
      leads: 0,
      openEnquiries: 1,
    });
    expect(computeClientStats([])).toEqual({
      active: 0,
      keyAccounts: 0,
      leads: 0,
      openEnquiries: 0,
    });
  });

  it("searches secondary contacts", () => {
    expect(filterClients(rows, { filter: "All", search: "secondary" })).toHaveLength(1);
  });

  it("keeps archived records out of All", () => {
    const archived = [{ ...rows[0]!, archived: true }];
    expect(filterClients(archived, { filter: "All", search: "" })).toHaveLength(0);
    expect(filterClients(archived, { filter: "Archived", search: "" })).toHaveLength(1);
  });

  it("sorts without mutating input", () => {
    const input = [
      { ...rows[0]!, id: "z", name: "Zulu" },
      { ...rows[0]!, id: "a", name: "Alpha" },
    ];
    expect(sortClients(input, "name-asc").map((row) => row.name)).toEqual(["Alpha", "Zulu"]);
    expect(input[0]?.name).toBe("Zulu");
  });
});
