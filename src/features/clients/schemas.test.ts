import { describe, expect, it } from "vitest";
import { clientInputSchema } from "@/features/clients/schemas";

const valid = {
  name: "Blackridge Hotels",
  type: "Company" as const,
  status: "Active" as const,
  accountTier: "Key Account" as const,
  industry: "Hospitality",
  region: "South Africa",
  clientSince: "2026-09-29",
  accountOverview: "Seasonal campaigns.",
  preferredServices: ["Photography", "photography", "Film"],
  relationshipNotes: "Prefers concise proposals.",
  contacts: [
    {
      fullName: "James Mitchell",
      roleTitle: "Head of Marketing",
      email: "james@example.com",
      phone: "0123456789",
      isPrimary: true,
    },
  ],
};

describe("clientInputSchema", () => {
  it("normalizes duplicate preferred services", () => {
    const result = clientInputSchema.parse(valid);
    expect(result.preferredServices).toEqual(["Photography", "Film"]);
  });

  it("requires a role for company contacts", () => {
    const result = clientInputSchema.safeParse({
      ...valid,
      contacts: [{ ...valid.contacts[0], roleTitle: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("allows an individual contact without a role", () => {
    const result = clientInputSchema.safeParse({
      ...valid,
      type: "Individual",
      contacts: [{ ...valid.contacts[0], roleTitle: "" }],
    });
    expect(result.success).toBe(true);
  });

  it("requires exactly one primary contact", () => {
    const result = clientInputSchema.safeParse({
      ...valid,
      contacts: [{ ...valid.contacts[0], isPrimary: false }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate contact emails case-insensitively", () => {
    const result = clientInputSchema.safeParse({
      ...valid,
      contacts: [
        valid.contacts[0],
        { ...valid.contacts[0], email: " JAMES@example.com ", isPrimary: false },
      ],
    });
    expect(result.success).toBe(false);
  });
});
