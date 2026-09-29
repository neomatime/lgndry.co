import { describe, expect, it } from "vitest";
import { buildConversionDefaults } from "@/features/projects/conversion-view-model";

const client = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Blackridge Hotels",
  contacts: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      fullName: "James Mitchell",
      email: "james@example.com",
      phone: "",
      isPrimary: true,
    },
  ],
};

describe("buildConversionDefaults", () => {
  it("maps controlled fields and an unambiguous ISO date", () => {
    const result = buildConversionDefaults(
      {
        id: "e",
        clientId: client.id,
        fullName: "James Mitchell",
        projectType: "Film",
        location: "Limpopo",
        timeline: "2026-10-30",
        description: "Campaign brief",
        budget: "R10,000",
      },
      client,
    );
    expect(result.values.projectType).toBe("Film");
    expect(result.values.startDate).toBe("2026-10-30");
    expect(result.values.endDate).toBe("2026-10-30");
    expect(result.values.clientContactId).toBe(client.contacts[0]?.id);
    expect(result.values.budgetMin).toBe("");
  });

  it("preserves ambiguous timeline and budget as source reference", () => {
    const result = buildConversionDefaults(
      {
        id: "e",
        clientId: client.id,
        fullName: "James Mitchell",
        projectType: "Unknown",
        location: "",
        timeline: "Late spring",
        description: "",
        budget: "Flexible",
      },
      client,
    );
    expect(result.values.projectType).toBe("Other");
    expect(result.values.startDate).toBe("");
    expect(result.values.scheduleNotes).toBe("Late spring");
    expect(result.sourceBudget).toBe("Flexible");
  });
});
