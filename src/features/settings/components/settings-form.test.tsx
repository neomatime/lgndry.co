import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/features/settings/components/settings-form";
import type { OpsSettings } from "@/features/settings/types";

const mocks = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn() }));

vi.mock("@/features/settings/actions", () => ({ updateOpsSettings: mocks.update }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

const initialSettings: OpsSettings = {
  id: "00000000-0000-4000-8000-000000000001",
  workspaceName: "LGNDRY.Co",
  companyEmail: "info@lgndry-co.co.za",
  companyPhone: "0764862725",
  websiteUrl: "https://www.lgndry-co.co.za",
  businessAddress: "Polokwane",
  registrationNumber: "",
  timeZone: "Africa/Johannesburg",
  currency: "ZAR",
  defaultQuoteTerms: "Original terms",
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
};

describe("SettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({ status: "success", version: 2 });
  });

  it("renders real sections, fixed locale and the existing brand mark", () => {
    render(<SettingsForm initialSettings={initialSettings} />);
    expect(screen.getByLabelText("Workspace name")).toHaveValue("LGNDRY.Co");
    expect(screen.getByLabelText("Time zone")).toHaveValue("Africa/Johannesburg");
    expect(screen.getByLabelText("Currency")).toHaveValue("ZAR");
    expect(screen.getByAltText("LGNDRY.Co logo")).toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("edits terms, saves a normalized payload and adopts the returned version", async () => {
    render(<SettingsForm initialSettings={initialSettings} />);
    fireEvent.click(screen.getByRole("tab", { name: "Quotes & Invoices" }));
    fireEvent.change(screen.getByLabelText("Default quote terms"), {
      target: { value: "  Updated terms  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ defaultQuoteTerms: "Updated terms" }),
      1,
    );
    expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled(),
    );

    fireEvent.change(screen.getByLabelText("Default quote terms"), {
      target: { value: "Third version" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenLastCalledWith(expect.anything(), 2));
  });

  it("validates locally and preserves the invalid edit", () => {
    render(<SettingsForm initialSettings={initialSettings} />);
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByLabelText(/Workspace name/)).toHaveValue("");
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
  });

  it("discards unsaved changes", () => {
    render(<SettingsForm initialSettings={initialSettings} />);
    fireEvent.change(screen.getByLabelText("Company phone"), { target: { value: "011" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard Changes" }));
    expect(screen.getByLabelText("Company phone")).toHaveValue("0764862725");
    expect(screen.getByRole("button", { name: "Discard Changes" })).toBeDisabled();
  });

  it("keeps edits on conflict and can load current settings", async () => {
    mocks.update.mockResolvedValue({
      status: "conflict",
      currentVersion: 3,
      message: "These settings changed elsewhere. Load the current settings before saving.",
    });
    render(<SettingsForm initialSettings={initialSettings} />);
    fireEvent.change(screen.getByLabelText("Company phone"), { target: { value: "011" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    const load = await screen.findByRole("button", { name: "Load current settings" });
    expect(screen.getByLabelText("Company phone")).toHaveValue("011");
    fireEvent.click(load);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("prevents duplicate submission while an update is pending", async () => {
    let resolve!: (value: { status: "success"; version: number }) => void;
    mocks.update.mockReturnValue(new Promise((next) => (resolve = next)));
    render(<SettingsForm initialSettings={initialSettings} />);
    fireEvent.change(screen.getByLabelText("Company phone"), { target: { value: "011" } });
    const save = screen.getByRole("button", { name: "Save Changes" });
    fireEvent.click(save);
    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
    fireEvent.submit(screen.getByRole("button", { name: "Saving..." }).closest("form")!);
    expect(mocks.update).toHaveBeenCalledOnce();
    resolve({ status: "success", version: 2 });
    await screen.findByText("Settings saved.");
  });
});
