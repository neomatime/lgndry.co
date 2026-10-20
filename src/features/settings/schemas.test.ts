import { describe, expect, it } from "vitest";
import { opsSettingsInputSchema } from "@/features/settings/schemas";

const valid = {
  workspaceName: " LGNDRY.Co ",
  companyEmail: "INFO@LGNDRY-CO.CO.ZA",
  companyPhone: " 076 486 2725 ",
  websiteUrl: "https://www.lgndry-co.co.za",
  businessAddress: " Studio 1\nPolokwane ",
  registrationNumber: "",
  defaultQuoteTerms: " Payment confirms the booking. ",
  defaultRetainerPercentage: 50,
  defaultQuoteValidityDays: 7,
  defaultDepositDueDays: 3,
  bankName: "Bank",
  accountHolder: "LGNDRY.Co",
  accountNumber: "123456",
  branchCode: "250655",
  accountType: "Cheque",
  paymentReferenceInstructions: "Use the invoice number.",
  senderName: "LGNDRY.Co",
  senderEmail: "INFO@LGNDRY-CO.CO.ZA",
  replyToEmail: "INFO@LGNDRY-CO.CO.ZA",
};

describe("opsSettingsInputSchema", () => {
  it("normalizes whitespace, emails, and multiline plain text", () => {
    const parsed = opsSettingsInputSchema.parse(valid);
    expect(parsed.workspaceName).toBe("LGNDRY.Co");
    expect(parsed.companyEmail).toBe("info@lgndry-co.co.za");
    expect(parsed.companyPhone).toBe("076 486 2725");
    expect(parsed.businessAddress).toBe("Studio 1\nPolokwane");
    expect(parsed.defaultQuoteTerms).toBe("Payment confirms the booking.");
  });

  it("allows approved optional fields to remain blank", () => {
    const parsed = opsSettingsInputSchema.parse({
      ...valid,
      companyPhone: "",
      websiteUrl: "",
      businessAddress: "",
      defaultQuoteTerms: "",
      bankName: "",
      accountHolder: "",
      accountNumber: "",
      branchCode: "",
      accountType: "",
      paymentReferenceInstructions: "",
    });
    expect(parsed.websiteUrl).toBe("");
    expect(parsed.defaultQuoteTerms).toBe("");
  });

  it.each(["ftp://lgndry-co.co.za", "lgndry-co.co.za", "not a url"])(
    "rejects unsupported website %s",
    (websiteUrl) => {
      expect(opsSettingsInputSchema.safeParse({ ...valid, websiteUrl }).success).toBe(false);
    },
  );

  it.each([0, -1, 100.01, 50.001])("rejects invalid retainer percentage %s", (value) => {
    expect(
      opsSettingsInputSchema.safeParse({ ...valid, defaultRetainerPercentage: value }).success,
    ).toBe(false);
  });

  it.each([0, 1.5, 366])("rejects invalid quote validity days %s", (value) => {
    expect(
      opsSettingsInputSchema.safeParse({ ...valid, defaultQuoteValidityDays: value }).success,
    ).toBe(false);
  });

  it("requires names and valid email addresses", () => {
    const result = opsSettingsInputSchema.safeParse({
      ...valid,
      workspaceName: "",
      companyEmail: "bad",
      senderName: "",
      senderEmail: "bad",
      replyToEmail: "bad",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining([
        "workspaceName",
        "companyEmail",
        "senderName",
        "senderEmail",
        "replyToEmail",
      ]),
    );
  });
});
