import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "@/components/site/forms/date-picker";
import { Select } from "@/components/site/forms/select";
import { toISO } from "@/components/site/forms/date-utils";
import { ContactForm } from "@/features/lead-capture/components/contact-form";
import {
  BookingTrigger,
  LeadModalsProvider,
  PartnershipTrigger,
} from "@/features/lead-capture/components/lead-modals";

const actions = vi.hoisted(() => ({
  submitBooking: vi.fn(),
  submitPartnership: vi.fn(),
  submitContactLead: vi.fn(),
}));
vi.mock("@/features/lead-capture/actions", () => actions);

beforeEach(() => {
  vi.clearAllMocks();
  actions.submitBooking.mockResolvedValue({ ok: true });
  actions.submitPartnership.mockResolvedValue({ ok: true });
  actions.submitContactLead.mockResolvedValue({ ok: true });
});

const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });

/** Sets a themed Select the way a visitor would: open it, pick the option. */
function choose(container: HTMLElement, name: string, option: string) {
  const native = container.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
  const root = native.closest(".lgndry-select") as HTMLElement;
  fireEvent.click(within(root).getByRole("button", { expanded: false }));
  fireEvent.click(within(root).getByRole("option", { name: option }));
}

describe("Select", () => {
  it("starts on its placeholder and lists every option", () => {
    render(<Select name="x" options={["A", "B"]} placeholder="Pick one" required />);
    expect(screen.getByRole("button", { name: "Pick one" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Pick one", "A", "B"]);
  });

  it("opens, chooses an option, closes, and updates the real form value", () => {
    const { container } = render(<Select name="x" options={["A", "B"]} placeholder="Pick one" />);
    const native = container.querySelector("select") as HTMLSelectElement;
    const root = container.querySelector(".lgndry-select") as HTMLElement;

    fireEvent.click(screen.getByRole("button", { name: "Pick one" }));
    expect(root).toHaveClass("is-open");

    fireEvent.click(screen.getByRole("option", { name: "B" }));
    expect(native.value).toBe("B");
    expect(root).not.toHaveClass("is-open");
    expect(screen.getByRole("button", { name: "B", expanded: false })).toBeInTheDocument();
  });

  it("stays invalid until something is chosen when required", () => {
    const { container } = render(<Select name="x" options={["A"]} placeholder="Pick" required />);
    const native = container.querySelector("select") as HTMLSelectElement;
    expect(native.checkValidity()).toBe(false);
    choose(container, "x", "A");
    expect(native.checkValidity()).toBe(true);
  });

  it("closes on Escape and on an outside click", () => {
    const { container } = render(<Select name="x" options={["A"]} placeholder="Pick" />);
    const root = container.querySelector(".lgndry-select") as HTMLElement;

    fireEvent.click(screen.getByRole("button", { name: "Pick" }));
    fireEvent.keyDown(root, { key: "Escape" });
    expect(root).not.toHaveClass("is-open");

    fireEvent.click(screen.getByRole("button", { name: "Pick" }));
    fireEvent.click(document.body);
    expect(root).not.toHaveClass("is-open");
  });
});

describe("DatePicker", () => {
  const value = (container: HTMLElement) =>
    (container.querySelector('input[type="hidden"]') as HTMLInputElement).value;
  const open = () => fireEvent.click(document.querySelector(".datepicker-wrap") as HTMLElement);

  it("starts empty and opens a calendar on click", () => {
    const { container } = render(<DatePicker name="d" />);
    expect(value(container)).toBe("");
    expect(document.querySelector(".datepicker-popup")).toBeNull();
    open();
    expect(screen.getByRole("dialog", { name: "Choose date" })).toBeInTheDocument();
  });

  it("picking a day stores an ISO date, shows it readably and closes", () => {
    const { container } = render(<DatePicker name="d" />);
    open();
    fireEvent.click(screen.getAllByRole("button", { name: "15" })[0]!);
    const today = new Date();
    expect(value(container)).toBe(toISO(new Date(today.getFullYear(), today.getMonth(), 15)));
    expect(container.querySelector<HTMLInputElement>(".datepicker-display")!.value).toMatch(
      /^[A-Z][a-z]{2} 15, \d{4}$/,
    );
    expect(document.querySelector(".datepicker-popup")).toBeNull();
  });

  it("Today and Clear work (both were dead in the legacy picker)", () => {
    const { container } = render(<DatePicker name="d" />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(value(container)).toBe(toISO(new Date()));

    open();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(value(container)).toBe("");
  });

  it("navigates months and can be opened and closed from the keyboard", () => {
    const { container } = render(<DatePicker name="d" />);
    const field = container.querySelector(".datepicker-display") as HTMLInputElement;
    fireEvent.keyDown(field, { key: "Enter" });
    const title = () => document.querySelector(".datepicker-title")!.textContent;
    const before = title();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(title()).not.toBe(before);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".datepicker-popup")).toBeNull();
  });
});

function renderBooking() {
  return render(
    <LeadModalsProvider>
      <BookingTrigger href="mailto:x@y.z?subject=Booking%20a%20session" className="t">
        Book a session
      </BookingTrigger>
    </LeadModalsProvider>,
  );
}

const dialog = () => document.querySelector(".booking-modal") as HTMLElement;
const next = () => screen.getByRole("button", { name: /Next Step|Send Request|Send Application/ });

function fillBookingSteps(container: HTMLElement) {
  // Step 1
  choose(dialog(), "session_type", "Portrait Session");
  fireEvent.click(screen.getByLabelText("Portraiture"));
  type(dialog().querySelector('textarea[name="project_details"]')!, "Family portraits");
  fireEvent.click(next());
  // Step 2
  type(dialog().querySelector('input[name="preferred_time"]')!, "10:00");
  type(dialog().querySelector('input[name="session_location"]')!, "Studio");
  choose(dialog(), "date_flexibility", "Exact date only");
  fireEvent.click(next());
  // Step 3
  type(dialog().querySelector('input[name="client_name"]')!, "Thandi Nkosi");
  type(dialog().querySelector('input[name="client_email"]')!, "thandi@example.com");
  type(dialog().querySelector('input[name="client_phone"]')!, "0821234567");
  choose(dialog(), "budget", "R10,000 - R25,000");
  fireEvent.click(next());
  return container;
}

describe("booking dialog", () => {
  it("is not built until a visitor asks for it, and the trigger keeps its mailto fallback", () => {
    renderBooking();
    expect(dialog()).toBeNull();
    expect(screen.getByRole("link", { name: "Book a session" })).toHaveAttribute(
      "href",
      "mailto:x@y.z?subject=Booking%20a%20session",
    );
  });

  it("opens from the trigger without following the mailto link", () => {
    renderBooking();
    const link = screen.getByRole("link", { name: "Book a session" });
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false); // preventDefault was called
    expect(dialog()).toHaveClass("booking-modal--open");
    expect(dialog()).toHaveAttribute("aria-hidden", "false");
    expect(document.body).toHaveClass("booking-modal-lock");
  });

  it("won't leave step 1 until its required fields and a service are chosen", () => {
    renderBooking();
    fireEvent.click(screen.getByRole("link", { name: "Book a session" }));

    fireEvent.click(next()); // nothing filled in
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();

    choose(dialog(), "session_type", "Portrait Session");
    type(dialog().querySelector('textarea[name="project_details"]')!, "Details");
    fireEvent.click(next()); // still no service ticked
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.getByText("Select at least one service.")).toHaveClass("is-visible");

    fireEvent.click(screen.getByLabelText("Portraiture"));
    expect(screen.getByText("Select at least one service.")).not.toHaveClass("is-visible");
    fireEvent.click(next());
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
  });

  it("counts characters in the project box", () => {
    renderBooking();
    fireEvent.click(screen.getByRole("link", { name: "Book a session" }));
    type(dialog().querySelector('textarea[name="project_details"]')!, "hello");
    expect(screen.getByText("5/500")).toBeInTheDocument();
  });

  it("walks all four steps, shows a review, and submits exactly what was entered", async () => {
    const { container } = renderBooking();
    fireEvent.click(screen.getByRole("link", { name: "Book a session" }));
    fillBookingSteps(container);

    expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review your booking" })).toBeInTheDocument();
    const review = within(document.querySelector(".booking-modal__review") as HTMLElement);
    expect(review.getByText("Portraiture")).toBeInTheDocument();
    expect(review.getByText("Thandi Nkosi")).toBeInTheDocument();
    expect(review.getByText("Not provided")).toBeInTheDocument(); // company left blank

    // The final action can't run until the confirmation is ticked.
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));
    expect(actions.submitBooking).not.toHaveBeenCalled();

    fireEvent.click(dialog().querySelector('input[name="confirm_details"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));

    await waitFor(() => expect(actions.submitBooking).toHaveBeenCalledTimes(1));
    expect(actions.submitBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        session_type: "Portrait Session",
        services: "Portraiture",
        project_details: "Family portraits",
        preferred_date: "",
        preferred_time: "10:00",
        session_location: "Studio",
        date_flexibility: "Exact date only",
        client_name: "Thandi Nkosi",
        client_email: "thandi@example.com",
        client_phone: "0821234567",
        budget: "R10,000 - R25,000",
      }),
    );
    expect(actions.submitBooking.mock.calls[0]?.[0]).not.toHaveProperty("confirm_details");

    expect(await screen.findByRole("heading", { name: "Request sent" })).toBeInTheDocument();
  });

  it("shows an error and lets the visitor retry when sending fails", async () => {
    actions.submitBooking.mockResolvedValue({ ok: false, error: "nope" });
    const { container } = renderBooking();
    fireEvent.click(screen.getByRole("link", { name: "Book a session" }));
    fillBookingSteps(container);
    fireEvent.click(dialog().querySelector('input[name="confirm_details"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));

    expect(
      await screen.findByText(/Something went wrong sending your request/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Request" })).not.toBeDisabled();
  });

  it("closes on Escape and hands focus back to the trigger", () => {
    renderBooking();
    const link = screen.getByRole("link", { name: "Book a session" });
    fireEvent.click(link);
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(dialog()).toHaveAttribute("aria-hidden", "true");
    expect(dialog()).toHaveAttribute("inert");
    expect(document.body).not.toHaveClass("booking-modal-lock");
    expect(link).toHaveFocus();
  });

  it("always reopens on a clean first step", () => {
    renderBooking();
    const link = screen.getByRole("link", { name: "Book a session" });
    fireEvent.click(link);
    choose(dialog(), "session_type", "Portrait Session");
    fireEvent.keyDown(dialog(), { key: "Escape" });

    fireEvent.click(link);
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(dialog().querySelector<HTMLSelectElement>('select[name="session_type"]')!.value).toBe(
      "",
    );
  });

  it("offers the budget options from the live database, not the old HTML", () => {
    renderBooking();
    fireEvent.click(screen.getByRole("link", { name: "Book a session" }));
    const budget = dialog().querySelector<HTMLSelectElement>('select[name="budget"]')!;
    expect(Array.from(budget.options).map((o) => o.textContent)).toEqual([
      "Select budget range",
      "From R6,500 - R10,000",
      "R10,000 - R25,000",
      "R25,000+",
    ]);
  });
});

describe("partnership dialog", () => {
  it("opens its own dialog with partnership wording and a different last-step label", () => {
    render(
      <LeadModalsProvider>
        <PartnershipTrigger href="mailto:x@y.z" className="t">
          Apply to partner
        </PartnershipTrigger>
      </LeadModalsProvider>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Apply to partner" }));
    expect(dialog()).toHaveClass("booking-modal--partnership");
    expect(screen.getByRole("heading", { name: "Let's build a partnership." })).toBeInTheDocument();
    expect(document.querySelector('input[name="focus"]')).not.toBeNull();
  });
});

describe("contact form", () => {
  const form = () => document.querySelector("form.contact-form") as HTMLElement;

  function fillFirstStep() {
    choose(form(), "assistance_needed", "General enquiry");
    choose(form(), "project_readiness", "Early idea / exploring");
    choose(form(), "timeline", "This month");
    choose(form(), "budget_range", "Not sure yet");
    type(form().querySelector('textarea[name="message"]')!, "A shoot in Polokwane");
  }

  it("starts on step 1 and won't advance until it's complete", () => {
    render(<ContactForm />);
    const step = (i: number) => form().querySelector(`[data-contact-phase="${i}"]`) as HTMLElement;
    expect(step(0)).not.toHaveAttribute("hidden");
    expect(step(1)).toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("button", { name: /Next: contact details/ }));
    expect(step(1)).toHaveAttribute("hidden"); // incomplete: stays put

    fillFirstStep();
    fireEvent.click(screen.getByRole("button", { name: /Next: contact details/ }));
    expect(step(0)).toHaveAttribute("hidden");
    expect(step(1)).not.toHaveAttribute("hidden");
    expect(form().querySelector(".contact-form__step--active")?.textContent).toBe(
      "02 Contact details",
    );
  });

  it("can go back without losing what was entered", () => {
    render(<ContactForm />);
    fillFirstStep();
    fireEvent.click(screen.getByRole("button", { name: /Next: contact details/ }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(form().querySelector<HTMLTextAreaElement>('textarea[name="message"]')!.value).toBe(
      "A shoot in Polokwane",
    );
  });

  it("submits every answer, then replaces the form with a thank-you", async () => {
    render(<ContactForm />);
    fillFirstStep();
    fireEvent.click(screen.getByRole("button", { name: /Next: contact details/ }));
    type(form().querySelector('input[name="name"]')!, "Thandi Nkosi");
    type(form().querySelector('input[name="email"]')!, "thandi@example.com");
    type(form().querySelector('input[name="phone"]')!, "0821234567");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(actions.submitContactLead).toHaveBeenCalledTimes(1));
    expect(actions.submitContactLead).toHaveBeenCalledWith(
      expect.objectContaining({
        assistance_needed: "General enquiry",
        project_readiness: "Early idea / exploring",
        timeline: "This month",
        budget_range: "Not sure yet",
        message: "A shoot in Polokwane",
        name: "Thandi Nkosi",
        email: "thandi@example.com",
        phone: "0821234567",
        company: "",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Message sent" })).toBeInTheDocument();
  });

  it("does not send until the contact details are valid", () => {
    render(<ContactForm />);
    fillFirstStep();
    fireEvent.click(screen.getByRole("button", { name: /Next: contact details/ }));
    type(form().querySelector('input[name="name"]')!, "Thandi");
    type(form().querySelector('input[name="email"]')!, "not-an-email");
    type(form().querySelector('input[name="phone"]')!, "0821234567");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(actions.submitContactLead).not.toHaveBeenCalled();
  });

  it("explains a failure and lets the visitor try again", async () => {
    actions.submitContactLead.mockResolvedValue({ ok: false, error: "nope" });
    render(<ContactForm />);
    fillFirstStep();
    fireEvent.click(screen.getByRole("button", { name: /Next: contact details/ }));
    type(form().querySelector('input[name="name"]')!, "Thandi");
    type(form().querySelector('input[name="email"]')!, "thandi@example.com");
    type(form().querySelector('input[name="phone"]')!, "0821234567");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      await screen.findByText(/Something went wrong sending your message/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();
  });

  it("offers the budget options from the live database", () => {
    render(<ContactForm />);
    const budget = form().querySelector<HTMLSelectElement>('select[name="budget_range"]')!;
    expect(Array.from(budget.options).map((o) => o.textContent)).toEqual([
      "Select budget range",
      "From R5,000 - R15,000",
      "R15,000 - R35,000",
      "R35,000+",
      "Not sure yet",
    ]);
  });
});
