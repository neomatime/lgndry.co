import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectPlanEditor } from "@/features/projects/components/project-plan-editor";

describe("ProjectPlanEditor", () => {
  it("adds, edits, reorders, and removes stable plan rows", () => {
    const onTasksChange = vi.fn();
    render(
      <ProjectPlanEditor
        milestones={[]}
        tasks={[{ title: "First", dueDate: "", isCompleted: false }]}
        deliverables={[]}
        onMilestonesChange={vi.fn()}
        onTasksChange={onTasksChange}
        onDeliverablesChange={vi.fn()}
      />,
    );
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    fireEvent.click(addButtons[1]!);
    fireEvent.change(screen.getByLabelText("Task 2 title"), { target: { value: "Second" } });
    expect(onTasksChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ title: "First" }),
      expect.objectContaining({ title: "Second" }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Move task 2 up" }));
    expect(screen.getByLabelText("Task 1 title")).toHaveValue("Second");
    fireEvent.click(screen.getByRole("button", { name: "Remove task 2" }));
    expect(screen.queryByLabelText("Task 2 title")).not.toBeInTheDocument();
  });

  it("adds all three plan record types", () => {
    render(
      <ProjectPlanEditor
        milestones={[]}
        tasks={[]}
        deliverables={[]}
        onMilestonesChange={vi.fn()}
        onTasksChange={vi.fn()}
        onDeliverablesChange={vi.fn()}
      />,
    );
    for (const button of screen.getAllByRole("button", { name: "Add" })) fireEvent.click(button);
    expect(screen.getByLabelText("Milestone 1 title")).toBeInTheDocument();
    expect(screen.getByLabelText("Task 1 title")).toBeInTheDocument();
    expect(screen.getByLabelText("Deliverable 1 title")).toBeInTheDocument();
  });
});
