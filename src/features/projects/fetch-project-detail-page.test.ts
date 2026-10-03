import { beforeEach, describe, expect, it, vi } from "vitest";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";

type Result = { data: unknown; error: { message: string } | null };

const { baseMock, relatedMock } = vi.hoisted(() => ({ baseMock: vi.fn(), relatedMock: vi.fn() }));
const clientResult: Result = { data: { archived: false }, error: null };
const fromMock = vi.fn((table: string) => {
  if (table === "clients") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(clientResult) }) }),
    };
  }
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/features/projects/fetch-project-detail", () => ({ fetchProjectDetail: baseMock }));
vi.mock("@/features/follow-ups/fetch-related-follow-ups", () => ({
  fetchRelatedFollowUps: relatedMock,
}));
vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => ({ from: fromMock }),
}));

const ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";

function project(overrides: Record<string, unknown> = {}) {
  return { id: ID, name: "Autumn Campaign", clientId: CLIENT_ID, archived: false, ...overrides };
}

beforeEach(() => {
  baseMock.mockReset();
  relatedMock.mockReset();
  fromMock.mockClear();
  clientResult.data = { archived: false };
  clientResult.error = null;
  baseMock.mockResolvedValue({ status: "ok", project: project() });
  relatedMock.mockResolvedValue([]);
});

describe("fetchProjectDetailPage", () => {
  it("returns the project with its follow-ups grouped and its client's archived flag", async () => {
    clientResult.data = { archived: true };
    relatedMock.mockResolvedValue([
      followUpDetail({ id: "f-open", status: "Open", dueDate: "2099-01-01" }),
      followUpDetail({ id: "f-done", status: "Completed", completedAt: "2026-09-29T08:00:00Z" }),
    ]);

    const { fetchProjectDetailPage } =
      await import("@/features/projects/fetch-project-detail-page");
    const result = await fetchProjectDetailPage(ID);

    expect(relatedMock).toHaveBeenCalledWith("project_id", ID);
    expect(fromMock).toHaveBeenCalledWith("clients");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.project).toEqual(project());
      expect(result.followUps.related.actionable.map((row) => row.id)).toEqual(["f-open"]);
      expect(result.followUps.related.completed.map((row) => row.id)).toEqual(["f-done"]);
      expect(result.followUps).toMatchObject({
        archived: false,
        clientId: CLIENT_ID,
        clientArchived: true,
      });
    }
  });

  it("carries an archived project's flag so Add can be withheld", async () => {
    baseMock.mockResolvedValue({ status: "ok", project: project({ archived: true }) });
    const { fetchProjectDetailPage } =
      await import("@/features/projects/fetch-project-detail-page");
    const result = await fetchProjectDetailPage(ID);
    expect(result.status === "ok" && result.followUps.archived).toBe(true);
  });

  it("treats zero follow-ups as an empty, successful list", async () => {
    const { fetchProjectDetailPage } =
      await import("@/features/projects/fetch-project-detail-page");
    const result = await fetchProjectDetailPage(ID);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.followUps.related.total).toBe(0);
  });

  it("fails the page when the follow-ups are unavailable, rather than showing none", async () => {
    relatedMock.mockResolvedValue(null);
    const { fetchProjectDetailPage } =
      await import("@/features/projects/fetch-project-detail-page");
    expect(await fetchProjectDetailPage(ID)).toEqual({ status: "error" });
  });

  it("fails the page when the client lookup fails", async () => {
    clientResult.error = { message: "connection refused" };
    const { fetchProjectDetailPage } =
      await import("@/features/projects/fetch-project-detail-page");
    expect(await fetchProjectDetailPage(ID)).toEqual({ status: "error" });
  });

  it.each([{ status: "not-found" }, { status: "error" }])(
    "passes $status through without asking for anything else",
    async (base) => {
      baseMock.mockResolvedValue(base);
      const { fetchProjectDetailPage } =
        await import("@/features/projects/fetch-project-detail-page");
      expect(await fetchProjectDetailPage(ID)).toEqual(base);
      expect(relatedMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    },
  );
});
