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

  it("supports arrow, home and end keyboard navigation", () => {
    render(
      <Tabs
        items={[
          { id: "a", label: "Overview", content: <p>Overview content</p> },
          { id: "b", label: "Attachments", content: <p>Attachments content</p> },
          { id: "c", label: "Activity", content: <p>Activity content</p> },
        ]}
      />,
    );
    const overview = screen.getByRole("tab", { name: "Overview" });
    const attachments = screen.getByRole("tab", { name: "Attachments" });
    const activity = screen.getByRole("tab", { name: "Activity" });

    overview.focus();
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(attachments).toHaveFocus();
    expect(attachments).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Attachments content")).toBeInTheDocument();

    fireEvent.keyDown(attachments, { key: "End" });
    expect(activity).toHaveFocus();
    fireEvent.keyDown(activity, { key: "Home" });
    expect(overview).toHaveFocus();
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });

  it("associates tabs with the active panel", () => {
    render(<Tabs items={[{ id: "a", label: "Overview", content: <p>Overview content</p> }]} />);
    const tab = screen.getByRole("tab", { name: "Overview" });
    const panel = screen.getByRole("tabpanel");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });
});
