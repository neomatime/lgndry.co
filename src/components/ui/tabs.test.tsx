import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs } from "@/components/ui/tabs";

describe("Tabs", () => {
  it("renders the first tab's content by default", () => {
    render(
      <Tabs
        items={[
          { id: "a", label: "Overview", content: <p>Overview content</p> },
          { id: "b", label: "Attachments", content: <p>Attachments content</p> },
        ]}
      />,
    );
    expect(screen.getByText("Overview content")).toBeInTheDocument();
    expect(screen.queryByText("Attachments content")).not.toBeInTheDocument();
  });

  it("switches content when a tab is clicked", () => {
    render(
      <Tabs
        items={[
          { id: "a", label: "Overview", content: <p>Overview content</p> },
          { id: "b", label: "Attachments", content: <p>Attachments content</p> },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Attachments" }));
    expect(screen.getByText("Attachments content")).toBeInTheDocument();
    expect(screen.queryByText("Overview content")).not.toBeInTheDocument();
  });

  it("respects an explicit defaultTabId", () => {
    render(
      <Tabs
        defaultTabId="b"
        items={[
          { id: "a", label: "Overview", content: <p>Overview content</p> },
          { id: "b", label: "Attachments", content: <p>Attachments content</p> },
        ]}
      />,
    );
    expect(screen.getByText("Attachments content")).toBeInTheDocument();
  });
});
