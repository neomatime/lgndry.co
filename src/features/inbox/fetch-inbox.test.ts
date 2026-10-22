import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { message: string } | null };

const results: Record<string, Result> = {
  email_threads: { data: [], error: null },
  email_accounts: { data: null, error: null },
  clients: { data: [], error: null },
  client_contacts: { data: [], error: null },
  enquiries: { data: [], error: null },
  projects: { data: [], error: null },
  commercial_quotes: { data: [], error: null },
  commercial_invoices: { data: [], error: null },
  follow_ups: { data: [], error: null },
};

const projectsSelect = vi.fn<(select: string) => void>();

function terminal(table: string) {
  return Promise.resolve(results[table]);
}

const fromMock = vi.fn((table: string) => ({
  select: (select: string) => {
    if (table === "projects") projectsSelect(select);
    return {
      order: () => terminal(table),
      eq: () => ({
        order: () => terminal(table),
        maybeSingle: () => terminal(table),
      }),
    };
  },
}));

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

beforeEach(() => {
  for (const result of Object.values(results)) {
    result.data = [];
    result.error = null;
  }
  results.email_accounts!.data = null;
  vi.clearAllMocks();
});

describe("fetchInbox", () => {
  it("loads project link options through the projects.client relationship", async () => {
    results.projects!.data = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        client: "22222222-2222-4222-8222-222222222222",
        name: "Autumn Campaign",
      },
    ];

    const { fetchInbox } = await import("@/features/inbox/fetch-inbox");
    const result = await fetchInbox();

    expect(projectsSelect).toHaveBeenCalledWith("id, client, name");
    expect(result?.options.projects).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        label: "Autumn Campaign",
        parentId: "22222222-2222-4222-8222-222222222222",
      },
    ]);
  });

  it("returns null when an option query fails", async () => {
    results.projects!.error = { message: "column projects.client_id does not exist" };

    const { fetchInbox } = await import("@/features/inbox/fetch-inbox");
    expect(await fetchInbox()).toBeNull();
  });
});
