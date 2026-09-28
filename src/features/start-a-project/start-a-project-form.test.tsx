import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prepareProjectEnquiry = vi.fn();
const finalizeProjectEnquiry = vi.fn();
const startTusUpload = vi.fn();
const abortUpload = vi.fn();

vi.mock("@/features/start-a-project/actions", () => ({
  prepareProjectEnquiry: (formData: FormData, descriptors: unknown[]) =>
    prepareProjectEnquiry(formData, descriptors),
  finalizeProjectEnquiry: (formData: FormData, sessionId: string, sessionSecret: string) =>
    finalizeProjectEnquiry(formData, sessionId, sessionSecret),
}));
vi.mock("@/features/start-a-project/tus-upload", () => ({
  startTusUpload: (options: unknown) => startTusUpload(options),
}));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  }),
}));

const SESSION_ID = "123e4567-e89b-42d3-a456-426614174000";
const SESSION_SECRET = "s".repeat(43);
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

type UploadOptions = {
  file: File;
  endpoint: string;
  token: string;
  storagePath: string;
  mimeType: string;
  onProgress: (percentage: number) => void;
};

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

function readyResult(descriptors: { fileName: string; sizeBytes: number; mimeType: string }[]) {
  return {
    status: "ready" as const,
    sessionId: SESSION_ID,
    sessionSecret: SESSION_SECRET,
    uploads: descriptors.map((descriptor, index) => ({
      ...descriptor,
      index,
      storagePath: `${SESSION_ID}/${index}-${descriptor.fileName}`,
      token: `token-${index}`,
    })),
  };
}

function expectTextOnly(formData: FormData) {
  expect([...formData.values()].every((value) => typeof value === "string")).toBe(true);
  expect(formData.has("attachments")).toBe(false);
}

beforeEach(() => {
  vi.clearAllMocks();
  abortUpload.mockResolvedValue(undefined);
  prepareProjectEnquiry.mockImplementation(
    async (_formData: FormData, descriptors: Parameters<typeof readyResult>[0]) =>
      readyResult(descriptors),
  );
  finalizeProjectEnquiry.mockResolvedValue({ status: "complete" });
  startTusUpload.mockImplementation((options: UploadOptions) => {
    options.onProgress(100);
    return { done: Promise.resolve(), abort: abortUpload };
  });
});

describe("StartAProjectForm", () => {
  it("renders every field from the website scope, including the honeypot", async () => {
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
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

  it("rejects an oversized file at the picker", async () => {
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    render(<StartAProjectForm />);

    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: { files: [pdfFile("huge.pdf", 15 * 1024 * 1024 + 1)] },
    });

    expect(await screen.findByText(/over the 15 MB limit/)).toBeInTheDocument();
    expect(screen.queryByText("huge.pdf")).toBeNull();
  });

  it("rejects a bad magic-byte signature before preparation", async () => {
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    render(<StartAProjectForm />);
    const disguised = new File([new Uint8Array([0x4d, 0x5a, 0x90])], "brief.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: { files: [disguised] },
    });

    expect(await screen.findByText(/does not look like a valid PDF/)).toBeInTheDocument();
    expect(prepareProjectEnquiry).not.toHaveBeenCalled();
  });

  it("lists a valid attachment and can remove it before preparation", async () => {
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    render(<StartAProjectForm />);

    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: { files: [pdfFile()] },
    });
    expect(await screen.findByText("brief.pdf")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("brief.pdf")).toBeNull();
  });

  it("finalizes a no-file submission with text-only Server Action payloads", async () => {
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(prepareProjectEnquiry).toHaveBeenCalledOnce());
    await waitFor(() => expect(finalizeProjectEnquiry).toHaveBeenCalledOnce());
    expectTextOnly(prepareProjectEnquiry.mock.calls[0]![0] as FormData);
    expectTextOnly(finalizeProjectEnquiry.mock.calls[0]![0] as FormData);
    expect(startTusUpload).not.toHaveBeenCalled();
    expect(await screen.findByText("Project received")).toBeInTheDocument();
  });

  it("uploads a chosen file directly, then finalizes without file bytes", async () => {
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: { files: [pdfFile()] },
    });
    await screen.findByText("brief.pdf");

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(startTusUpload).toHaveBeenCalledOnce());
    expect(startTusUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://project.storage.supabase.co/storage/v1/upload/resumable",
        token: "token-0",
        storagePath: `${SESSION_ID}/0-brief.pdf`,
        mimeType: "application/pdf",
      }),
    );
    expectTextOnly(prepareProjectEnquiry.mock.calls[0]![0] as FormData);
    expectTextOnly(finalizeProjectEnquiry.mock.calls[0]![0] as FormData);
    expect(await screen.findByText("Project received")).toBeInTheDocument();
  });

  it("shows per-file progress without finalizing early", async () => {
    let resolveUpload: () => void = () => undefined;
    startTusUpload.mockImplementation((options: UploadOptions) => {
      options.onProgress(42);
      return {
        done: new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
        abort: abortUpload,
      };
    });
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: { files: [pdfFile()] },
    });
    await screen.findByText("brief.pdf");

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("42%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "42");
    expect(finalizeProjectEnquiry).not.toHaveBeenCalled();

    await act(async () => resolveUpload());
    expect(await screen.findByText("Project received")).toBeInTheDocument();
  });

  it("retries only the failed file and preserves completed uploads", async () => {
    startTusUpload
      .mockImplementationOnce((options: UploadOptions) => {
        options.onProgress(100);
        return { done: Promise.resolve(), abort: abortUpload };
      })
      .mockImplementationOnce(() => ({
        done: Promise.reject(new Error("connection lost")),
        abort: abortUpload,
      }))
      .mockImplementationOnce((options: UploadOptions) => {
        options.onProgress(100);
        return { done: Promise.resolve(), abort: abortUpload };
      });

    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: { files: [pdfFile("first.pdf"), pdfFile("second.pdf")] },
    });
    await screen.findByText("second.pdf");

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled());
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
    expect(finalizeProjectEnquiry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Project received")).toBeInTheDocument();
    expect(startTusUpload).toHaveBeenCalledTimes(3);
    expect(prepareProjectEnquiry).toHaveBeenCalledOnce();
  });

  it("offers retry when TUS cannot start", async () => {
    startTusUpload.mockImplementationOnce(() => {
      throw new Error("TUS unavailable");
    });
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: { files: [pdfFile()] },
    });
    await screen.findByText("brief.pdf");

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("lets a visitor retry finalization without creating another session", async () => {
    finalizeProjectEnquiry
      .mockResolvedValueOnce({
        status: "error",
        code: "failed",
        error: "Please try finishing again.",
      })
      .mockResolvedValueOnce({ status: "complete" });
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Please try finishing again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try finishing again" }));

    expect(await screen.findByText("Project received")).toBeInTheDocument();
    expect(prepareProjectEnquiry).toHaveBeenCalledOnce();
    expect(finalizeProjectEnquiry).toHaveBeenCalledTimes(2);
  });

  it("does not prepare twice while a submission is active", async () => {
    let resolvePreparation: (value: ReturnType<typeof readyResult>) => void = () => undefined;
    prepareProjectEnquiry.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreparation = resolve;
        }),
    );
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    const { container } = render(<StartAProjectForm />);
    fillRequiredFields();
    const form = container.querySelector("form")!;

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(prepareProjectEnquiry).toHaveBeenCalledOnce();
    await act(async () => resolvePreparation(readyResult([])));
    expect(await screen.findByText("Project received")).toBeInTheDocument();
  });

  it("does not call the server action when a required field is empty", async () => {
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    const { container } = render(<StartAProjectForm />);

    fireEvent.submit(container.querySelector("form")!);

    expect(prepareProjectEnquiry).not.toHaveBeenCalled();
  });

  it("aborts active uploads when the form unmounts", async () => {
    startTusUpload.mockReturnValue({
      done: new Promise<void>(() => undefined),
      abort: abortUpload,
    });
    const { StartAProjectForm } =
      await import("@/features/start-a-project/components/start-a-project-form");
    const { container, unmount } = render(<StartAProjectForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: { files: [pdfFile()] },
    });
    await screen.findByText("brief.pdf");
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(startTusUpload).toHaveBeenCalledOnce());

    unmount();

    expect(abortUpload).toHaveBeenCalledOnce();
  });
});
