import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage, { metadata } from "@/app/(app)/ops/settings/page";
import type { OpsSettings } from "@/features/settings/types";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn() }));

vi.mock("@/lib/auth/guards", () => ({ requireOpsUser: mocks.auth }));
vi.mock("@/features/settings/fetch-ops-settings", () => ({ fetchOpsSettings: mocks.fetch }));
vi.mock("@/features/settings/components/settings-form", () => ({
  SettingsForm: ({ initialSettings }: { initialSettings: OpsSettings }) => (
    <output data-testid="settings-form">
      {initialSettings.workspaceName}:{initialSettings.version}
    </output>
  ),
}));

const settings = {
  id: "00000000-0000-4000-8000-000000000001",
  workspaceName: "LGNDRY.Co",
  companyEmail: "info@lgndry-co.co.za",
  companyPhone: "",
  websiteUrl: "https://www.lgndry-co.co.za",
  businessAddress: "",
  registrationNumber: "",
  timeZone: "Africa/Johannesburg",
  currency: "ZAR",
  defaultQuoteTerms: "",
  defaultRetainerPercentage: 50,
  defaultQuoteValidityDays: 7,
  defaultDepositDueDays: 3,
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  branchCode: "",
  accountType: "",
  paymentReferenceInstructions: "",
  senderName: "LGNDRY.Co",
  senderEmail: "info@lgndry-co.co.za",
  replyToEmail: "info@lgndry-co.co.za",
  version: 1,
  updatedAt: "2026-10-20T08:00:00Z",
} satisfies OpsSettings;

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ id: "admin" });
    mocks.fetch.mockResolvedValue({ status: "ok", settings });
  });

  it("authenticates before fetching and renders the settings form", async () => {
    const order: string[] = [];
    mocks.auth.mockImplementation(async () => {
      order.push("auth");
      return { id: "admin" };
    });
    mocks.fetch.mockImplementation(async () => {
      order.push("fetch");
      return { status: "ok", settings };
    });
    render(await SettingsPage());
    expect(order).toEqual(["auth", "fetch"]);
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(
      screen.getByText("Manage workspace details and commercial defaults."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage Team" })).toHaveAttribute(
      "href",
      "/ops/settings/team",
    );
    expect(screen.getByTestId("settings-form")).toHaveTextContent("LGNDRY.Co:1");
  });

  it("renders a distinct unavailable state and no form on fetch failure", async () => {
    mocks.fetch.mockResolvedValue({ status: "error" });
    render(await SettingsPage());
    expect(screen.getByText("Settings are temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-form")).not.toBeInTheDocument();
  });

  it("sets the page metadata", () => {
    expect(metadata).toEqual({ title: "Settings" });
  });
});
