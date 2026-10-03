import { beforeEach, describe, expect, it, vi } from "vitest";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";

const { baseMock, relatedMock } = vi.hoisted(() => ({ baseMock: vi.fn(), relatedMock: vi.fn() }));

vi.mock("@/features/clients/fetch-client-detail", () => ({ fetchClientDetail: baseMock }));
vi.mock("@/features/follow-ups/fetch-related-follow-ups", () => ({
  fetchRelatedFollowUps: relatedMock,
}));

const ID = "11111111-1111-1111-1111-111111111111";

function client(overrides: Record<string, unknown> = {}) {
  return { id: ID, name: "Blackridge Hotels", archived: false, ...overrides };
}

beforeEach(() => {
  baseMock.mockReset();
  relatedMock.mockReset();
  baseMock.mockResolvedValue({ status: "ok", client: client() });
  relatedMock.mockResolvedValue([]);
});

describe("fetchClientDetailPage", () => {
  it("returns the client with every follow-up linked to it, grouped for display", async () => {
    relatedMock.mockResolvedValue([
      followUpDetail({ id: "f-open", status: "Open", dueDate: "2099-01-01" }),
      followUpDetail({ id: "f-done", status: "Completed", completedAt: "2026-09-29T08:00:00Z" }),
      followUpDetail({ id: "f-gone", status: "Cancelled", cancelledAt: "2026-09-29T08:00:00Z" }),
    ]);

    const { fetchClientDetailPage } = await import("@/features/clients/fetch-client-detail-page");
    const result = await fetchClientDetailPage(ID);

    expect(baseMock).toHaveBeenCalledWith(ID);
    expect(relatedMock).toHaveBeenCalledWith("client_id", ID);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.client).toEqual(client());
      const { related } = result.followUps;
      expect(related.total).toBe(3);
      expect(related.actionable.map((row) => row.id)).toEqual(["f-open"]);
      expect(related.completed.map((row) => row.id)).toEqual(["f-done"]);
      expect(related.cancelled.map((row) => row.id)).toEqual(["f-gone"]);
      expect(result.followUps).toMatchObject({
        archived: false,
        clientId: ID,
        clientArchived: false,
      });
    }
  });

  it("treats zero follow-ups as an empty, successful list", async () => {
    const { fetchClientDetailPage } = await import("@/features/clients/fetch-client-detail-page");
    const result = await fetchClientDetailPage(ID);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.followUps.related.total).toBe(0);
  });

  it("carries an archived client's flags so Add can be withheld", async () => {
    baseMock.mockResolvedValue({ status: "ok", client: client({ archived: true }) });
    const { fetchClientDetailPage } = await import("@/features/clients/fetch-client-detail-page");
    const result = await fetchClientDetailPage(ID);
    expect(result.status === "ok" && result.followUps).toMatchObject({
      archived: true,
      clientArchived: true,
    });
  });

  it("fails the page when the follow-ups are unavailable, rather than showing none", async () => {
    relatedMock.mockResolvedValue(null);
    const { fetchClientDetailPage } = await import("@/features/clients/fetch-client-detail-page");
    expect(await fetchClientDetailPage(ID)).toEqual({ status: "error" });
  });

  it.each([{ status: "not-found" }, { status: "error" }])(
    "passes $status through without asking for follow-ups",
    async (base) => {
      baseMock.mockResolvedValue(base);
      const { fetchClientDetailPage } = await import("@/features/clients/fetch-client-detail-page");
      expect(await fetchClientDetailPage(ID)).toEqual(base);
      expect(relatedMock).not.toHaveBeenCalled();
    },
  );
});
