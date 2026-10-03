import { beforeEach, describe, expect, it, vi } from "vitest";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";

type Result = { data: unknown; error: { message: string } | null };

const { baseMock, relatedMock } = vi.hoisted(() => ({ baseMock: vi.fn(), relatedMock: vi.fn() }));
const linkResult: Result = { data: null, error: null };
const clientResult: Result = { data: null, error: null };
const fromMock = vi.fn((table: string) => {
  const result = table === "enquiries" ? linkResult : table === "clients" ? clientResult : null;
  if (!result) throw new Error(`unexpected table: ${table}`);
  return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(result) }) }) };
});

vi.mock("@/features/enquiries/fetch-enquiry-detail", () => ({ fetchEnquiryDetail: baseMock }));
vi.mock("@/features/follow-ups/fetch-related-follow-ups", () => ({
  fetchRelatedFollowUps: relatedMock,
}));
vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

const ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const enquiry = { id: ID, fullName: "Thandi Mokoena", status: "New" };

beforeEach(() => {
  baseMock.mockReset();
  relatedMock.mockReset();
  fromMock.mockClear();
  linkResult.data = { client_id: CLIENT_ID, archived: false };
  linkResult.error = null;
  clientResult.data = { archived: false };
  clientResult.error = null;
  baseMock.mockResolvedValue({ status: "ok", enquiry });
  relatedMock.mockResolvedValue([]);
});

describe("fetchEnquiryDetailPage", () => {
  it("returns the enquiry with its follow-ups, client link and archived flags", async () => {
    clientResult.data = { archived: true };
    relatedMock.mockResolvedValue([
      followUpDetail({ id: "f-open", status: "Open", dueDate: "2099-01-01" }),
      followUpDetail({ id: "f-done", status: "Completed", completedAt: "2026-09-29T08:00:00Z" }),
    ]);

    const { fetchEnquiryDetailPage } =
      await import("@/features/enquiries/fetch-enquiry-detail-page");
    const result = await fetchEnquiryDetailPage(ID);

    expect(relatedMock).toHaveBeenCalledWith("enquiry_id", ID);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.enquiry).toEqual(enquiry);
      expect(result.followUps.related.actionable.map((row) => row.id)).toEqual(["f-open"]);
      expect(result.followUps.related.completed.map((row) => row.id)).toEqual(["f-done"]);
      expect(result.followUps).toMatchObject({
        archived: false,
        clientId: CLIENT_ID,
        clientArchived: true,
      });
    }
  });

  it("carries an archived enquiry's flag so Add can be withheld", async () => {
    linkResult.data = { client_id: CLIENT_ID, archived: true };
    const { fetchEnquiryDetailPage } =
      await import("@/features/enquiries/fetch-enquiry-detail-page");
    const result = await fetchEnquiryDetailPage(ID);
    expect(result.status === "ok" && result.followUps.archived).toBe(true);
  });

  it("tolerates an enquiry with no linked client and skips the client lookup", async () => {
    linkResult.data = { client_id: null, archived: false };
    const { fetchEnquiryDetailPage } =
      await import("@/features/enquiries/fetch-enquiry-detail-page");
    const result = await fetchEnquiryDetailPage(ID);
    expect(result.status === "ok" && result.followUps).toMatchObject({
      clientId: null,
      clientArchived: false,
    });
    expect(fromMock).not.toHaveBeenCalledWith("clients");
  });

  it("treats zero follow-ups as an empty, successful list", async () => {
    const { fetchEnquiryDetailPage } =
      await import("@/features/enquiries/fetch-enquiry-detail-page");
    const result = await fetchEnquiryDetailPage(ID);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.followUps.related.total).toBe(0);
  });

  it("fails the page when the follow-ups are unavailable, rather than showing none", async () => {
    relatedMock.mockResolvedValue(null);
    const { fetchEnquiryDetailPage } =
      await import("@/features/enquiries/fetch-enquiry-detail-page");
    expect(await fetchEnquiryDetailPage(ID)).toEqual({ status: "error" });
  });

  it.each([
    ["enquiry link", linkResult],
    ["client", clientResult],
  ])("fails the page when the %s lookup fails", async (_label, failed) => {
    failed.error = { message: "connection refused" };
    const { fetchEnquiryDetailPage } =
      await import("@/features/enquiries/fetch-enquiry-detail-page");
    expect(await fetchEnquiryDetailPage(ID)).toEqual({ status: "error" });
  });

  it.each([{ status: "not-found" }, { status: "error" }])(
    "passes $status through without asking for anything else",
    async (base) => {
      baseMock.mockResolvedValue(base);
      const { fetchEnquiryDetailPage } =
        await import("@/features/enquiries/fetch-enquiry-detail-page");
      expect(await fetchEnquiryDetailPage(ID)).toEqual(base);
      expect(relatedMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    },
  );
});
