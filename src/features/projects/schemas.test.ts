import { describe, expect, it } from "vitest";
import { projectInputSchema } from "@/features/projects/schemas";

const valid = () => ({
  name: "Autumn Campaign",
  clientId: "11111111-1111-4111-8111-111111111111",
  clientContactId: "",
  projectType: "Documentary" as const,
  services: ["Photography", "photography", "Film"],
  overview: "A considered campaign.",
  location: "Johannesburg",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  scheduleNotes: "Morning call.",
  peopleResources: "Two cameras.",
  budgetMin: "1000",
  budgetMax: "2500.50",
  currency: "ZAR",
  paymentStatus: "Deposit Pending" as const,
  deliveryStatus: "Not Ready" as const,
  status: "Planning" as const,
  milestones: [{ title: "Kickoff", description: "", dueDate: "", status: "Pending" as const }],
  tasks: [{ title: "Confirm brief", dueDate: "", isCompleted: false }],
  deliverables: [{ title: "Final selects", dueDate: "", status: "Not Started" as const }],
});

describe("projectInputSchema", () => {
  it("accepts a complete project and removes duplicate services", () => {
    const result = projectInputSchema.parse(valid());
    expect(result.services).toEqual(["Photography", "Film"]);
  });

  it("rejects an end date before the start date", () => {
    const result = projectInputSchema.safeParse({
      ...valid(),
      endDate: "2026-09-30",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["endDate"]);
  });

  it("rejects an inverted budget range", () => {
    const result = projectInputSchema.safeParse({
      ...valid(),
      budgetMin: "3000",
      budgetMax: "2000",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["budgetMax"]);
  });

  it("rejects unsupported statuses and malformed currency", () => {
    expect(projectInputSchema.safeParse({ ...valid(), status: "Draft" }).success).toBe(false);
    expect(projectInputSchema.safeParse({ ...valid(), currency: "zar" }).success).toBe(false);
  });

  it("accepts a same-day project and empty optional money values", () => {
    const input = valid();
    expect(
      projectInputSchema.safeParse({
        ...input,
        endDate: input.startDate,
        budgetMin: "",
        budgetMax: "",
      }).success,
    ).toBe(true);
  });
});
