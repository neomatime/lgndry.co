import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewFollowUpPage from "@/app/(app)/ops/follow-ups/new/page";
import { CONTEXT_NOTICE } from "@/features/follow-ups/follow-up-context";
import type { FollowUpClientOption } from "@/features/follow-ups/types";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), options: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.auth }));
vi.mock("@/features/follow-ups/fetch-follow-up-form-data", () => ({
  fetchFollowUpFormOptions: mocks.options,
}));
vi.mock("@/features/follow-ups/components/follow-up-form", () => ({
  FollowUpForm: (props: Record<string, unknown>) => (
    <div>
      Follow-up form: <output data-testid="props">{JSON.stringify(props)}</output>
    </div>
  ),
}));

const CLIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_CLIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ENQUIRY = "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1";
const OTHER_ENQUIRY = "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2";
const clients: FollowUpClientOption[] = [
  {
    id: CLIENT,
    name: "Blackridge",
    contacts: [],
    enquiries: [{ id: ENQUIRY, label: "Film" }],
    projects: [],
  },
  {
    id: OTHER_CLIENT,
    name: "Lumen",
    contacts: [],
    enquiries: [{ id: OTHER_ENQUIRY, label: "Shoot" }],
    projects: [],
  },
];
const props = (query: Record<string, string | string[]> = {}) => ({
  searchParams: Promise.resolve(query),
});
const rendered = () => JSON.parse(screen.getByTestId("props").textContent!);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "admin" });
  mocks.options.mockResolvedValue(clients);
});

describe("NewFollowUpPage", () => {
  it("authenticates before loading options and renders an empty create form", async () => {
    render(await NewFollowUpPage(props()));
    expect(mocks.auth).toHaveBeenCalledBefore(mocks.options);
    expect(screen.getByRole("heading", { name: "New Follow-up" })).toBeInTheDocument();
    expect(rendered()).toMatchObject({
      defaultClientId: "",
      defaultContactId: "",
      defaultEnquiryId: "",
      defaultProjectId: "",
    });
    expect(rendered().contextNotice).toBeUndefined();
  });

  it("pre-selects context only after checking it against the loaded records", async () => {
    render(await NewFollowUpPage(props({ clientId: CLIENT, enquiryId: ENQUIRY })));
    expect(rendered()).toMatchObject({ defaultClientId: CLIENT, defaultEnquiryId: ENQUIRY });
    expect(rendered().contextNotice).toBeUndefined();
  });

  it("ignores an enquiry that belongs to a different client and says so calmly", async () => {
    render(await NewFollowUpPage(props({ clientId: CLIENT, enquiryId: OTHER_ENQUIRY })));
    expect(rendered()).toMatchObject({
      defaultClientId: "",
      defaultEnquiryId: "",
      contextNotice: CONTEXT_NOTICE,
    });
  });

  it("does not crash on junk query values", async () => {
    render(await NewFollowUpPage(props({ clientId: "not-a-uuid", projectId: ["x", "y"] })));
    expect(rendered()).toMatchObject({ defaultClientId: "", contextNotice: CONTEXT_NOTICE });
  });

  it("shows a temporary-failure state when options cannot load", async () => {
    mocks.options.mockResolvedValue(null);
    render(await NewFollowUpPage(props({ clientId: CLIENT })));
    expect(screen.getByText("Follow-up form is temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("props")).not.toBeInTheDocument();
  });
});
