import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowUpForm } from "@/features/follow-ups/components/follow-up-form";
import type { FollowUpClientOption, FollowUpInput } from "@/features/follow-ups/types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/features/follow-ups/actions", () => ({
  createFollowUp: mocks.create,
  updateFollowUp: mocks.update,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONTACT_A = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const CONTACT_B = "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2";
const ENQUIRY_A = "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1";
const ENQUIRY_B = "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2";
const PROJECT_A = "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1";
const PROJECT_B = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2";
const FOLLOW_UP = "11111111-1111-4111-8111-111111111111";
const SUCCESSOR = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";

const clients: FollowUpClientOption[] = [
  {
    id: CLIENT_A,
    name: "Blackridge",
    contacts: [
      { id: CONTACT_A, fullName: "Thandi Mokoena", email: "t@example.com", phone: "", role: "" },
    ],
    enquiries: [{ id: ENQUIRY_A, label: "Brand film · E1E1E1E1" }],
    projects: [{ id: PROJECT_A, label: "Autumn Campaign" }],
  },
  {
    id: CLIENT_B,
    name: "Lumen",
    contacts: [
      { id: CONTACT_B, fullName: "Sipho Dlamini", email: "s@example.com", phone: "", role: "" },
    ],
    enquiries: [{ id: ENQUIRY_B, label: "Photo shoot · E2E2E2E2" }],
    projects: [{ id: PROJECT_B, label: "Winter Lookbook" }],
  },
];

const noRecurrence: FollowUpInput["recurrence"] = {
  enabled: false,
  frequency: "Weekly",
  intervalCount: 1,
  weekdays: [],
  monthAnchor: null,
  endsOn: "",
  maxOccurrences: null,
};
const weeklyRecurrence: FollowUpInput["recurrence"] = {
  enabled: true,
  frequency: "Weekly",
  intervalCount: 1,
  weekdays: [3],
  monthAnchor: null,
  endsOn: "",
  maxOccurrences: null,
};

function existingValues(overrides: Partial<FollowUpInput> = {}): FollowUpInput {
  return {
    clientId: CLIENT_A,
    contactId: CONTACT_A,
    enquiryId: ENQUIRY_A,
    projectId: "",
    followUpType: "Quote Follow-up",
    customType: "",
    title: "Chase the quote",
    overview: "Overview text",
    notes: "Internal note",
    dueDate: "2026-10-14",
    dueTime: "09:30",
    priority: "High",
    contactMethods: ["Email", "Phone"],
    checklist: [{ id: ITEM, label: "Send reminder", sortOrder: 0 }],
    recurrence: noRecurrence,
    editScope: "future",
    ...overrides,
  };
}
const existing = (overrides: Partial<FollowUpInput> = {}, version = 4) => ({
  id: FOLLOW_UP,
  version,
  values: existingValues(overrides),
});
const recurring = () => existing({ recurrence: weeklyRecurrence, editScope: "occurrence" });

beforeEach(() => {
  vi.clearAllMocks();
  const success = { status: "success", followUpId: FOLLOW_UP };
  mocks.create.mockResolvedValue(success);
  mocks.update.mockResolvedValue(success);
});

const field = (label: string | RegExp) => screen.getByLabelText(label);
const submitCreate = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create Follow-up" }));
const optionLabels = (label: string) =>
  [...(field(label) as HTMLSelectElement).options].map((option) => option.textContent);

function fillCreate() {
  fireEvent.change(field("Client"), { target: { value: CLIENT_A } });
  fireEvent.change(field("Title"), { target: { value: "  Call about the deposit " } });
  fireEvent.change(field("Due date"), { target: { value: "2026-10-14" } });
  fireEvent.click(field("Email"));
}

describe("FollowUpForm - structure and keyboard", () => {
  it("uses native, labelled controls in a logical tab order with no positive tabindex", () => {
    render(<FollowUpForm clients={clients} />);
    const form = document.querySelector("form")!;
    const controls = [
      ...form.querySelectorAll<HTMLElement>("input, select, textarea, button, a[href]"),
    ].filter((element) => !(element as HTMLInputElement).disabled);
    expect(controls.some((element) => Number(element.getAttribute("tabindex")) > 0)).toBe(false);
    const names = controls.map(
      (element) =>
        element.getAttribute("aria-label") ??
        (element as HTMLInputElement).labels?.[0]?.textContent?.trim() ??
        element.textContent?.trim(),
    );
    const order = [
      "Client",
      "Contact",
      "Related enquiry",
      "Related project",
      "Follow-up type",
      "Title",
      "Overview",
      "Internal notes",
      "Due date",
      "Due time (optional)",
      "Priority",
      "Email",
      "Phone",
      "WhatsApp",
      "Video Call",
      "In Person",
      "Add checklist item",
      "Add",
      "Repeat this follow-upCompleting it creates the next occurrence automatically.",
      "Create Follow-up",
      "Cancel",
    ];
    expect(names).toEqual(order);
    for (const heading of ["Relationship", "Details", "Schedule", "Checklist", "Repeat"])
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/ops/follow-ups");
  });

  it("submits with the keyboard (native form submit) rather than click handlers", async () => {
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
  });
});

describe("FollowUpForm - client cascade and relations", () => {
  it("scopes contact, enquiry and project options to the chosen client", () => {
    render(<FollowUpForm clients={clients} />);
    expect(optionLabels("Contact")).toEqual(["No selected contact"]);
    expect(optionLabels("Related enquiry")).toEqual(["No related enquiry"]);
    fireEvent.change(field("Client"), { target: { value: CLIENT_A } });
    expect(optionLabels("Contact")).toEqual(["No selected contact", "Thandi Mokoena"]);
    expect(optionLabels("Related enquiry")).toEqual([
      "No related enquiry",
      "Brand film · E1E1E1E1",
    ]);
    expect(optionLabels("Related project")).toEqual(["No related project", "Autumn Campaign"]);
    fireEvent.change(field("Client"), { target: { value: CLIENT_B } });
    expect(optionLabels("Contact")).toEqual(["No selected contact", "Sipho Dlamini"]);
    expect(optionLabels("Related project")).toEqual(["No related project", "Winter Lookbook"]);
  });

  it("clears contact, enquiry and project when the client changes", () => {
    render(
      <FollowUpForm
        clients={clients}
        defaultClientId={CLIENT_A}
        defaultContactId={CONTACT_A}
        defaultEnquiryId={ENQUIRY_A}
      />,
    );
    expect(field("Contact")).toHaveValue(CONTACT_A);
    expect(field("Related enquiry")).toHaveValue(ENQUIRY_A);
    fireEvent.change(field("Client"), { target: { value: CLIENT_B } });
    expect(field("Contact")).toHaveValue("");
    expect(field("Related enquiry")).toHaveValue("");
    expect(field("Related project")).toHaveValue("");
  });

  it("keeps related selections when the same client is re-chosen", () => {
    render(
      <FollowUpForm clients={clients} defaultClientId={CLIENT_A} defaultProjectId={PROJECT_A} />,
    );
    fireEvent.change(field("Client"), { target: { value: CLIENT_A } });
    expect(field("Related project")).toHaveValue(PROJECT_A);
  });

  it("links an enquiry or a project, never both", () => {
    render(<FollowUpForm clients={clients} defaultClientId={CLIENT_A} />);
    fireEvent.change(field("Related enquiry"), { target: { value: ENQUIRY_A } });
    expect(field("Related project")).toBeDisabled();
    fireEvent.change(field("Related enquiry"), { target: { value: "" } });
    expect(field("Related project")).toBeEnabled();
    fireEvent.change(field("Related project"), { target: { value: PROJECT_A } });
    expect(field("Related enquiry")).toBeDisabled();
  });

  it("pre-selects contextual defaults and shows a calm notice when given one", () => {
    render(
      <FollowUpForm
        clients={clients}
        defaultClientId={CLIENT_B}
        defaultProjectId={PROJECT_B}
        contextNotice="We couldn't use that link."
      />,
    );
    expect(field("Client")).toHaveValue(CLIENT_B);
    expect(field("Related project")).toHaveValue(PROJECT_B);
    expect(screen.getByRole("status")).toHaveTextContent("We couldn't use that link.");
  });

  it("labels a saved relation that is no longer offered instead of showing None", () => {
    render(
      <FollowUpForm clients={[{ ...clients[0]!, contacts: [] }]} existingFollowUp={existing()} />,
    );
    expect(field("Contact")).toHaveValue(CONTACT_A);
    expect(optionLabels("Contact")).toContain("Current contact (no longer available)");
  });

  it("keeps an archived client selectable on an existing follow-up", () => {
    render(<FollowUpForm clients={[clients[1]!]} existingFollowUp={existing()} />);
    expect(field("Client")).toHaveValue(CLIENT_A);
    expect(optionLabels("Client")).toContain("Current client (no longer available)");
  });
});

describe("FollowUpForm - conditional fields", () => {
  it("shows the custom type only for Other and clears it when switching away", () => {
    render(<FollowUpForm clients={clients} />);
    expect(screen.queryByLabelText("Custom type")).not.toBeInTheDocument();
    fireEvent.change(field("Follow-up type"), { target: { value: "Other" } });
    fireEvent.change(field("Custom type"), { target: { value: "Site walkthrough" } });
    fireEvent.change(field("Follow-up type"), { target: { value: "Approval" } });
    expect(screen.queryByLabelText("Custom type")).not.toBeInTheDocument();
    fireEvent.change(field("Follow-up type"), { target: { value: "Other" } });
    expect(field("Custom type")).toHaveValue("");
  });

  it("supports multiple contact methods", async () => {
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    fireEvent.click(field("In Person"));
    fireEvent.click(field("WhatsApp"));
    fireEvent.click(field("Email"));
    fireEvent.click(field("Email"));
    submitCreate();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    // Always submitted in the fixed list order, regardless of click order.
    expect(mocks.create.mock.calls[0]![0].contactMethods).toEqual([
      "Email",
      "WhatsApp",
      "In Person",
    ]);
  });

  it("shows recurrence rule controls only after repeating is switched on", () => {
    render(<FollowUpForm clients={clients} />);
    expect(screen.queryByLabelText("Repeats")).not.toBeInTheDocument();
    fireEvent.click(field(/Repeat this follow-up/));
    expect(field("Repeats")).toBeInTheDocument();
  });
});

describe("FollowUpForm - create", () => {
  it("submits the full schema shape and redirects to the new detail page", async () => {
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    fireEvent.change(field("Related enquiry"), { target: { value: ENQUIRY_A } });
    fireEvent.change(field("Contact"), { target: { value: CONTACT_A } });
    fireEvent.change(field("Priority"), { target: { value: "Low" } });
    fireEvent.change(field("Due time (optional)"), { target: { value: "08:15" } });
    fireEvent.change(field("Add checklist item"), { target: { value: "Send invoice" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    submitCreate();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith({
      clientId: CLIENT_A,
      contactId: CONTACT_A,
      enquiryId: ENQUIRY_A,
      projectId: "",
      followUpType: "Client Check-in",
      customType: "",
      title: "Call about the deposit",
      overview: "",
      notes: "",
      dueDate: "2026-10-14",
      dueTime: "08:15",
      priority: "Low",
      contactMethods: ["Email"],
      checklist: [{ label: "Send invoice", sortOrder: 0 }],
      recurrence: noRecurrence,
      editScope: "future",
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith(`/ops/follow-ups/${FOLLOW_UP}`);
  });

  it("builds a weekly recurrence from the controls", async () => {
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    fireEvent.click(field(/Repeat this follow-up/));
    fireEvent.click(field("Monday"));
    fireEvent.change(field("Every (week(s))"), { target: { value: "2" } });
    fireEvent.click(field("After a number of occurrences"));
    fireEvent.change(field("Number of occurrences"), { target: { value: "8" } });
    submitCreate();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0]![0].recurrence).toEqual({
      enabled: true,
      frequency: "Weekly",
      intervalCount: 2,
      weekdays: [1, 3],
      monthAnchor: null,
      endsOn: "",
      maxOccurrences: 8,
    });
  });

  it("builds a monthly recurrence ending on a date and drops stale weekdays", async () => {
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    fireEvent.click(field(/Repeat this follow-up/));
    fireEvent.change(field("Repeats"), { target: { value: "Monthly" } });
    fireEvent.change(field("Day of the month"), { target: { value: "30" } });
    fireEvent.click(field("On a date"));
    fireEvent.change(field("End date"), { target: { value: "2027-03-31" } });
    submitCreate();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0]![0].recurrence).toEqual({
      enabled: true,
      frequency: "Monthly",
      intervalCount: 1,
      weekdays: [],
      monthAnchor: 30,
      endsOn: "2027-03-31",
      maxOccurrences: null,
    });
  });

  it("builds a custom every-N-days recurrence", async () => {
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    fireEvent.click(field(/Repeat this follow-up/));
    fireEvent.change(field("Repeats"), { target: { value: "Custom" } });
    fireEvent.change(field("Every (day(s))"), { target: { value: "10" } });
    submitCreate();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0]![0].recurrence).toMatchObject({
      enabled: true,
      frequency: "Custom",
      intervalCount: 10,
      weekdays: [],
    });
  });

  it("does not let hidden recurrence settings block a non-repeating follow-up", async () => {
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    fireEvent.click(field(/Repeat this follow-up/));
    fireEvent.change(field("Every (week(s))"), { target: { value: "" } });
    fireEvent.click(field(/Repeat this follow-up/));
    submitCreate();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0]![0].recurrence).toEqual(noRecurrence);
  });

  it("ignores a second submit while one is in flight", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.create.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    submitCreate();
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled());
    fireEvent.submit(document.querySelector("form")!);
    expect(mocks.create).toHaveBeenCalledOnce();
    finish({ status: "success", followUpId: FOLLOW_UP });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
  });
});

describe("FollowUpForm - validation and failures", () => {
  it("shows field errors, keeps every entered value, and never calls the action", () => {
    render(<FollowUpForm clients={clients} />);
    fireEvent.change(field("Client"), { target: { value: CLIENT_A } });
    fireEvent.change(field("Title"), { target: { value: "Keep me" } });
    fireEvent.change(field("Overview"), { target: { value: "Also keep me" } });
    fireEvent.change(field("Follow-up type"), { target: { value: "Other" } });
    submitCreate();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(field("Due date")).toHaveAccessibleDescription("Choose a valid date.");
    expect(field("Due date")).toHaveAttribute("aria-invalid", "true");
    expect(field("Custom type")).toHaveAccessibleDescription("Name the follow-up type.");
    expect(screen.getByText("Choose a contact method.")).toBeInTheDocument();
    expect(field("Title")).toHaveValue("Keep me");
    expect(field("Overview")).toHaveValue("Also keep me");
    expect(field("Client")).toHaveValue(CLIENT_A);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Check the highlighted follow-up details");
    expect(alert).toHaveFocus();
  });

  it("requires a client and a title", () => {
    render(<FollowUpForm clients={clients} />);
    submitCreate();
    expect(field("Client")).toHaveAccessibleDescription("Choose a client.");
    expect(field("Title")).toHaveAccessibleDescription(/This field is required\./);
  });

  it("shows recurrence and checklist errors beside the right controls", () => {
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    fireEvent.click(field(/Repeat this follow-up/));
    fireEvent.click(field("Wednesday"));
    fireEvent.change(field("Every (week(s))"), { target: { value: "0" } });
    fireEvent.click(field("On a date"));
    fireEvent.change(field("End date"), { target: { value: "2026-10-01" } });
    fireEvent.change(field("Add checklist item"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(field("Checklist item 1"), { target: { value: "  " } });
    submitCreate();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByText("Choose at least one day.")).toBeInTheDocument();
    expect(field("Every (week(s))")).toHaveAccessibleDescription(
      "Enter a whole number from 1 to 365.",
    );
    expect(field("End date")).toHaveAccessibleDescription(
      "End date cannot be before the first due date.",
    );
    expect(field("Checklist item 1")).toHaveAccessibleDescription("This field is required.");
  });

  it("shows server field errors and keeps entered values", async () => {
    mocks.create.mockResolvedValue({
      status: "invalid",
      message: "Check the highlighted details and try again.",
      fieldErrors: { title: ["Title is not allowed."], "recurrence.maxOccurrences": ["Bad"] },
    });
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    submitCreate();
    expect(await screen.findByText("Title is not allowed.")).toBeInTheDocument();
    expect(field("Title")).toHaveValue("  Call about the deposit ");
    expect(field("Title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted details");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows a server rejection without field errors as a form-level message", async () => {
    mocks.create.mockResolvedValue({
      status: "invalid",
      message: "The selected contact, enquiry, or project doesn't belong to this client.",
    });
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    submitCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("doesn't belong to this client");
  });

  it("shows the action's error message and keeps values", async () => {
    mocks.create.mockResolvedValue({ status: "error", message: "Please try again shortly." });
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    submitCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again shortly.");
    expect(field("Client")).toHaveValue(CLIENT_A);
    // The button re-enables once the save attempt settles.
    expect(await screen.findByRole("button", { name: "Create Follow-up" })).toBeEnabled();
  });

  it("shows a calm message when the action throws, then allows a retry", async () => {
    mocks.create.mockRejectedValueOnce(new Error("network"));
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    submitCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't save this follow-up just now. Please try again.",
    );
    await screen.findByRole("button", { name: "Create Follow-up" });
    submitCreate();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/ops/follow-ups/${FOLLOW_UP}`));
  });
});

describe("FollowUpForm - edit", () => {
  it("loads existing values and updates with the id and version", async () => {
    render(<FollowUpForm clients={clients} existingFollowUp={existing()} />);
    expect(field("Title")).toHaveValue("Chase the quote");
    expect(field("Contact")).toHaveValue(CONTACT_A);
    expect(field("Due time (optional)")).toHaveValue("09:30");
    expect(field("Phone")).toBeChecked();
    expect(field("Checklist item 1")).toHaveValue("Send reminder");
    expect(screen.queryByText("Apply changes to")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/ops/follow-ups/${FOLLOW_UP}`,
    );
    fireEvent.change(field("Title"), { target: { value: "Chase the revised quote" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const [id, version, input] = mocks.update.mock.calls[0]!;
    expect(id).toBe(FOLLOW_UP);
    expect(version).toBe(4);
    expect(input).toMatchObject({
      title: "Chase the revised quote",
      checklist: [{ id: ITEM, label: "Send reminder", sortOrder: 0 }],
      editScope: "future",
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith(`/ops/follow-ups/${FOLLOW_UP}`);
  });

  it("asks which occurrences to change and locks the rule for this occurrence only", async () => {
    render(<FollowUpForm clients={clients} existingFollowUp={recurring()} />);
    expect(screen.getByRole("group", { name: "Apply changes to" })).toBeInTheDocument();
    expect(field("This occurrence only")).toBeChecked();
    expect(field("This and future occurrences")).not.toBeChecked();
    for (const label of ["Repeats", "Wednesday", "Never", /Repeat this follow-up/])
      expect(field(label)).toBeDisabled();
    expect(
      screen.getByText(/Choose .This and future occurrences. to change how this follow-up repeats/),
    ).toBeInTheDocument();
    fireEvent.change(field("Title"), { target: { value: "Only this one" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const input = mocks.update.mock.calls[0]![2];
    expect(input.editScope).toBe("occurrence");
    expect(input.recurrence).toEqual(weeklyRecurrence);
  });

  it("lets this-and-future edits change the rule", async () => {
    render(<FollowUpForm clients={clients} existingFollowUp={recurring()} />);
    fireEvent.click(field("This and future occurrences"));
    expect(field("Repeats")).toBeEnabled();
    fireEvent.click(field("Friday"));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const input = mocks.update.mock.calls[0]![2];
    expect(input.editScope).toBe("future");
    expect(input.recurrence).toEqual({ ...weeklyRecurrence, weekdays: [3, 5] });
  });

  it("discards unsaved rule edits when switching back to this occurrence only", async () => {
    render(<FollowUpForm clients={clients} existingFollowUp={recurring()} />);
    fireEvent.click(field("This and future occurrences"));
    fireEvent.click(field("Friday"));
    fireEvent.click(field("This occurrence only"));
    expect(field("Friday")).not.toBeChecked();
    expect(field("Friday")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0]![2].recurrence).toEqual(weeklyRecurrence);
  });

  it("lets a recurring follow-up stop repeating from this and future occurrences", async () => {
    render(<FollowUpForm clients={clients} existingFollowUp={recurring()} />);
    fireEvent.click(field("This and future occurrences"));
    fireEvent.click(field(/Repeat this follow-up/));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0]![2]).toMatchObject({
      editScope: "future",
      recurrence: noRecurrence,
    });
  });

  it("locks recurrence on an occurrence whose series has ended, without a scope choice", () => {
    render(
      <FollowUpForm
        clients={clients}
        existingFollowUp={existing({ editScope: "occurrence", recurrence: noRecurrence })}
      />,
    );
    expect(screen.queryByText("Apply changes to")).not.toBeInTheDocument();
    expect(field(/Repeat this follow-up/)).toBeDisabled();
    expect(screen.getByText(/series that has ended/)).toBeInTheDocument();
  });

  it("lets a standalone follow-up start repeating", async () => {
    render(<FollowUpForm clients={clients} existingFollowUp={existing()} />);
    fireEvent.click(field(/Repeat this follow-up/));
    expect(field("Repeats")).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0]![2]).toMatchObject({
      editScope: "future",
      recurrence: { enabled: true, frequency: "Weekly", weekdays: [3] },
    });
  });
});

describe("FollowUpForm - conflicts and missing records", () => {
  it("explains a conflict calmly, preserves edits, and offers a refresh path", async () => {
    mocks.update.mockResolvedValue({
      status: "conflict",
      message: "Follow-up changed elsewhere.",
    });
    render(<FollowUpForm clients={clients} existingFollowUp={existing()} />);
    fireEvent.change(field("Title"), { target: { value: "My unsaved title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Follow-up changed elsewhere.");
    expect(alert).toHaveTextContent("replaces the changes you've made here");
    expect(field("Title")).toHaveValue("My unsaved title");
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Load latest version" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    // The form never silently resubmits over the newer version.
    expect(mocks.update).toHaveBeenCalledOnce();
  });

  it("links a conflicting occurrence to its successor", async () => {
    mocks.update.mockResolvedValue({
      status: "conflict",
      message: "This occurrence already moved on.",
      successorId: SUCCESSOR,
    });
    render(<FollowUpForm clients={clients} existingFollowUp={existing()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("link", { name: "Open the next occurrence" })).toHaveAttribute(
      "href",
      `/ops/follow-ups/${SUCCESSOR}`,
    );
  });

  it("explains a vanished follow-up and links back to the list", async () => {
    mocks.update.mockResolvedValue({
      status: "not-found",
      message: "That follow-up is no longer available.",
    });
    render(<FollowUpForm clients={clients} existingFollowUp={existing()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer available");
    expect(screen.getByRole("link", { name: "Back to follow-ups" })).toHaveAttribute(
      "href",
      "/ops/follow-ups",
    );
  });

  it("treats an unexpected idle result as a failure rather than a success", async () => {
    mocks.create.mockResolvedValue({ status: "idle" });
    render(<FollowUpForm clients={clients} />);
    fillCreate();
    submitCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't save this follow-up");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
