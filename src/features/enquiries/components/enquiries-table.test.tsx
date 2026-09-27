import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { EnquiriesTable } from "@/features/enquiries/components/enquiries-table";
import type { EnquiryListItem } from "@/features/enquiries/list-view-model";

function row(over: Partial<EnquiryListItem> = {}): EnquiryListItem {
  return {
    id: "e1",
    fullName: "Thandi Mokoena",
    company: "Blackridge Hotels",
    email: "thandi@example.com",
    phone: "0761234567",
    projectType: "Documentary",
    location: "Polokwane",
    timeline: "Next 1-3 months",
    description: "A short documentary series.",
    budget: "R20,000 - R35,000",
    status: "New",
    createdAt: "2026-09-27T10:00:00Z",
    attachmentCount: 1,
    ...over,
  };
}

describe("EnquiriesTable", () => {
  it("renders every row", () => {
    render(
      <EnquiriesTable
        rows={[
          row({ id: "1", fullName: "Thandi Mokoena" }),
          row({ id: "2", fullName: "James Mitchell" }),
        ]}
      />,
    );
    expect(screen.getByText("Thandi Mokoena")).toBeInTheDocument();
    expect(screen.getByText("James Mitchell")).toBeInTheDocument();
  });

  it("narrows the list when searching", () => {
    render(
      <EnquiriesTable
        rows={[
          row({ id: "1", fullName: "Thandi Mokoena" }),
          row({ id: "2", fullName: "James Mitchell" }),
        ]}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search enquiries..."), {
      target: { value: "James" },
    });
    expect(screen.queryByText("Thandi Mokoena")).not.toBeInTheDocument();
    expect(screen.getByText("James Mitchell")).toBeInTheDocument();
  });

  it("filters by status tab", () => {
    render(
      <EnquiriesTable
        rows={[
          row({ id: "1", fullName: "Thandi Mokoena", status: "New" }),
          row({ id: "2", fullName: "James Mitchell", status: "Quoted" }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Quoted/ }));
    expect(screen.queryByText("Thandi Mokoena")).not.toBeInTheDocument();
    expect(screen.getByText("James Mitchell")).toBeInTheDocument();
  });

  it("shows an inline preview when a row's checkbox is checked", () => {
    render(<EnquiriesTable rows={[row({ description: "A short documentary series." })]} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("A short documentary series.")).toBeInTheDocument();
  });

  it("navigates to the detail page when a row is clicked", () => {
    render(<EnquiriesTable rows={[row({ id: "e1" })]} />);
    fireEvent.click(screen.getByText("Thandi Mokoena"));
    expect(push).toHaveBeenCalledWith("/ops/enquiries/e1");
  });
});
