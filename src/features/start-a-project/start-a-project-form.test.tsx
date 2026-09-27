import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const submitProjectEnquiry = vi.fn();
vi.mock("@/features/start-a-project/actions", () => ({
  submitProjectEnquiry: (formData: FormData) => submitProjectEnquiry(formData),
}));

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
function pdfFile(name = "brief.pdf", size = 1024) {
  const bytes = size > PDF_BYTES.length ? new Uint8Array(size) : PDF_BYTES;
  if (size > PDF_BYTES.length) bytes.set(PDF_BYTES);
  return new File([bytes], name, { type: "application/pdf" });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Thandi Mokoena" } });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "thandi@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Phone / WhatsApp"), { target: { value: "0761234567" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Polokwane" } });
  fireEvent.change(screen.getByLabelText("Timeline"), { target: { value: "Next month" } });
  fireEvent.change(screen.getByLabelText("Tell us about the project"), {
    target: { value: "A short documentary series." },
  });
}

beforeEach(() => submitProjectEnquiry.mockReset());

describe("StartAProjectForm", () => {
  it("renders every field from the website scope, including the honeypot", async () => {
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    const { container } = render(<StartAProjectForm />);

    for (const label of [
      "Your name",
      "Company / brand",
      "Email address",
      "Phone / WhatsApp",
      "Location",
      "Timeline",
      "Tell us about the project",
      "Budget",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(container.querySelector('input[name="hp_website"]')).toBeInTheDocument();
  });

  it("rejects an oversized file at the file picker, before any submit", async () => {
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    render(<StartAProjectForm />);
    const input = screen.getByLabelText("Attachments") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pdfFile("huge.pdf", 15 * 1024 * 1024 + 1)] } });

    expect(await screen.findByText(/over the 15 MB limit/)).toBeInTheDocument();
    expect(screen.queryByText("huge.pdf")).toBeNull();
  });

  it("lists a valid attachment and can remove it", async () => {
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    render(<StartAProjectForm />);
    const input = screen.getByLabelText("Attachments") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pdfFile()] } });
    expect(await screen.findByText("brief.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("brief.pdf")).toBeNull();
  });

  it("submits the form (with a chosen file) and shows the success state", async () => {
    submitProjectEnquiry.mockResolvedValue({ ok: true });
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Attachments"), { target: { files: [pdfFile()] } });

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(submitProjectEnquiry).toHaveBeenCalledTimes(1));
    const sentFormData = submitProjectEnquiry.mock.calls[0]![0] as FormData;
    expect(sentFormData.get("full_name")).toBe("Thandi Mokoena");
    expect(sentFormData.getAll("attachments")).toHaveLength(1);
    expect(await screen.findByText("Project received")).toBeInTheDocument();
  });

  it("shows the server's error and lets the visitor try again", async () => {
    submitProjectEnquiry.mockResolvedValue({ ok: false, error: "Please try again in a moment." });
    const { StartAProjectForm } = await import(
      "@/features/start-a-project/components/start-a-project-form"
    );
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Please try again in a moment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send project details/ })).toBeEnabled();
  });
});
