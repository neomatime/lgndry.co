import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowUpDetailPage, { generateMetadata } from "@/app/(app)/ops/follow-ups/[id]/page";
import { followUpDetail } from "@/features/follow-ups/components/follow-up-test-data";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  detail: vi.fn(),
  archived: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.auth }));
vi.mock("@/features/follow-ups/fetch-follow-up-detail", () => ({
  fetchFollowUpDetail: mocks.detail,
}));
vi.mock("@/features/follow-ups/fetch-linked-archived", () => ({
  fetchLinkedArchived: mocks.archived,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/follow-ups/components/follow-up-detail", () => ({
  FollowUpDetailView: (props: {
    followUp: { title: string; scheduleState: string };
    now: string;
    archived: unknown;
    updated: boolean;
  }) => (
    <div>
      <p>detail: {props.followUp.title}</p>
      <p>state: {props.followUp.scheduleState}</p>
      <p>now: {props.now}</p>
      <p>updated: {String(props.updated)}</p>
      <p>archived: {JSON.stringify(props.archived)}</p>
    </div>
  ),
}));

const ID = "11111111-1111-4111-8111-111111111111";
const props = (search: { updated?: string | string[] } = {}, id = ID) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve(search),
});
const NONE = { client: false, contact: false, enquiry: false, project: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
  mocks.auth.mockResolvedValue({ id: "admin" });
  mocks.detail.mockResolvedValue({ status: "ok", followUp: followUpDetail() });
  mocks.archived.mockResolvedValue(NONE);
});

afterEach(() => vi.useRealTimers());

describe("FollowUpDetailPage", () => {
  it("authenticates before loading anything and renders the follow-up", async () => {
    render(await FollowUpDetailPage(props()));
    expect(mocks.auth).toHaveBeenCalledBefore(mocks.detail);
    expect(mocks.detail).toHaveBeenCalledWith(ID);
    expect(screen.getByText("detail: Chase the autumn quote")).toBeInTheDocument();
  });

  it("does not load data when authentication redirects", async () => {
    mocks.auth.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(FollowUpDetailPage(props())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it("returns a 404 for an unknown or malformed id and never looks up links", async () => {
    mocks.detail.mockResolvedValue({ status: "not-found" });
    await expect(FollowUpDetailPage(props({}, "not-a-real-id"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.detail).toHaveBeenCalledWith("not-a-real-id");
    expect(mocks.notFound).toHaveBeenCalled();
    expect(mocks.archived).not.toHaveBeenCalled();
  });

  it("renders a distinct temporary-unavailable state, not a 404 and not an error screen", async () => {
    mocks.detail.mockResolvedValue({ status: "error" });
    render(await FollowUpDetailPage(props()));
    expect(screen.getByText("This follow-up is temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Follow-ups" })).toHaveAttribute(
      "href",
      "/ops/follow-ups",
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.archived).not.toHaveBeenCalled();
  });

  it("re-evaluates the scheduling state against one request-time now", async () => {
    mocks.detail.mockResolvedValue({
      status: "ok",
      followUp: followUpDetail({ dueDate: "2026-09-29", dueTime: "", scheduleState: "Upcoming" }),
    });
    render(await FollowUpDetailPage(props()));
    expect(screen.getByText("state: Overdue")).toBeInTheDocument();
    expect(screen.getByText("now: 2026-09-30T08:00:00.000Z")).toBeInTheDocument();
  });

  it("asks which linked records are archived using the follow-up's own links", async () => {
    mocks.archived.mockResolvedValue({ ...NONE, enquiry: true });
    render(await FollowUpDetailPage(props()));
    expect(mocks.archived).toHaveBeenCalledWith({
      clientId: "client-1",
      contactId: "contact-1",
      enquiryId: "enquiry-1",
      projectId: undefined,
    });
    expect(screen.getByText(/"enquiry":true/)).toBeInTheDocument();
  });

  it("passes the edit-success flag only for ?updated=1", async () => {
    const { unmount } = render(await FollowUpDetailPage(props({ updated: "1" })));
    expect(screen.getByText("updated: true")).toBeInTheDocument();
    unmount();
    render(await FollowUpDetailPage(props({ updated: "0" })));
    expect(screen.getByText("updated: false")).toBeInTheDocument();
  });

  it("accepts a repeated updated parameter", async () => {
    render(await FollowUpDetailPage(props({ updated: ["1", "1"] })));
    expect(screen.getByText("updated: true")).toBeInTheDocument();
  });
});

describe("generateMetadata", () => {
  it("authenticates first and uses the reference and title", async () => {
    expect(await generateMetadata(props())).toEqual({ title: "FUP-0312 Chase the autumn quote" });
    expect(mocks.auth).toHaveBeenCalledBefore(mocks.detail);
  });

  it("falls back to a generic title for not-found and unavailable follow-ups", async () => {
    mocks.detail.mockResolvedValue({ status: "not-found" });
    expect(await generateMetadata(props())).toEqual({ title: "Follow-up" });
    mocks.detail.mockResolvedValue({ status: "error" });
    expect(await generateMetadata(props())).toEqual({ title: "Follow-up" });
  });

  it("does not load data when authentication redirects", async () => {
    mocks.auth.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(generateMetadata(props())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.detail).not.toHaveBeenCalled();
  });
});
