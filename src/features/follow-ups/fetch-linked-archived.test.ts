import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLinkedArchived } from "@/features/follow-ups/fetch-linked-archived";

const results = new Map<string, { data: unknown; error: { message: string } | null }>();
const fromMock = vi.fn((table: string) => ({
  select: () => ({
    eq: () => ({
      maybeSingle: () => Promise.resolve(results.get(table) ?? { data: null, error: null }),
    }),
  }),
}));

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

beforeEach(() => {
  results.clear();
  fromMock.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("fetchLinkedArchived", () => {
  it("reports which linked records are archived", async () => {
    results.set("clients", { data: { archived: true }, error: null });
    results.set("enquiries", { data: { archived: false }, error: null });
    results.set("projects", { data: { archived: true }, error: null });
    const result = await fetchLinkedArchived({
      clientId: "c",
      contactId: "k",
      enquiryId: "e",
      projectId: "p",
    });
    expect(result).toEqual({ client: true, contact: false, enquiry: false, project: true });
  });

  it("only queries the records that are linked", async () => {
    await fetchLinkedArchived({ clientId: "c" });
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["clients"]);
  });

  it("treats a failed lookup as not archived instead of failing the page", async () => {
    results.set("clients", { data: null, error: { message: "boom" } });
    await expect(fetchLinkedArchived({ clientId: "c", enquiryId: "e" })).resolves.toEqual({
      client: false,
      contact: false,
      enquiry: false,
      project: false,
    });
  });
});
