import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientArchiveControl } from "@/features/clients/components/client-archive-control";

const { refresh, setClientArchived } = vi.hoisted(() => ({
  refresh: vi.fn(),
  setClientArchived: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/clients/actions", () => ({ setClientArchived }));

beforeEach(() => {
  refresh.mockClear();
  setClientArchived.mockReset();
});

describe("ClientArchiveControl", () => {
  it("asks for confirmation before archiving", () => {
    render(
      <ClientArchiveControl
        clientId="11111111-1111-1111-1111-111111111111"
        clientName="Blackridge Hotels"
        archived={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive Client" }));
    expect(screen.getByText("Archive Blackridge Hotels?")).toBeInTheDocument();
    expect(setClientArchived).not.toHaveBeenCalled();
  });

  it.each([
    [false, "Archive Client", "Confirm Archive", true],
    [true, "Restore Client", "Confirm Restore", false],
  ] as const)("refreshes after a successful %s action", async (archived, open, confirm, next) => {
    setClientArchived.mockResolvedValue({
      status: "success",
      clientId: "11111111-1111-1111-1111-111111111111",
    });
    render(
      <ClientArchiveControl
        clientId="11111111-1111-1111-1111-111111111111"
        clientName="Blackridge Hotels"
        archived={archived}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: open }));
    fireEvent.click(screen.getByRole("button", { name: confirm }));

    await waitFor(() =>
      expect(setClientArchived).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111", next),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("links to the active client when restore finds an email conflict", async () => {
    setClientArchived.mockResolvedValue({
      status: "conflict",
      clientId: "22222222-2222-2222-2222-222222222222",
      error: "That email belongs to another active client.",
    });
    render(
      <ClientArchiveControl
        clientId="11111111-1111-1111-1111-111111111111"
        clientName="Blackridge Hotels"
        archived
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore Client" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Restore" }));

    const link = await screen.findByRole("link", { name: "View existing client" });
    expect(link).toHaveAttribute("href", "/ops/clients/22222222-2222-2222-2222-222222222222");
  });

  it("announces a failed action", async () => {
    setClientArchived.mockResolvedValue({ status: "error", error: "Please try again." });
    render(
      <ClientArchiveControl
        clientId="11111111-1111-1111-1111-111111111111"
        clientName="Blackridge Hotels"
        archived={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive Client" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Archive" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
