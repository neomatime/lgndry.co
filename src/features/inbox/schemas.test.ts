import { describe, expect, it } from "vitest";
import { attachmentUploadSchema, draftSchema, threadStateSchema } from "@/features/inbox/schemas";

describe("Inbox schemas", () => {
  it("accepts a complete outgoing draft", () => {
    expect(
      draftSchema.safeParse({
        toEmail: "client@example.com",
        subject: "Project update",
        body: "The updated schedule is attached.",
        intent: "send",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid recipients and empty messages", () => {
    expect(
      draftSchema.safeParse({
        toEmail: "not-an-email",
        subject: "",
        body: "",
        intent: "send",
      }).success,
    ).toBe(false);
  });

  it("caps attachments at 25 MiB and known safe types", () => {
    const draft = {
      toEmail: "client@example.com",
      subject: "Files",
      body: "Attached.",
    };
    expect(
      attachmentUploadSchema.safeParse({
        draft,
        file: { name: "brief.pdf", type: "application/pdf", size: 1024 },
      }).success,
    ).toBe(true);
    expect(
      attachmentUploadSchema.safeParse({
        draft,
        file: { name: "movie.exe", type: "application/x-msdownload", size: 1024 },
      }).success,
    ).toBe(false);
  });

  it("accepts only supported thread actions with a positive version", () => {
    expect(
      threadStateSchema.safeParse({
        threadId: "00000000-0000-4000-8000-000000000001",
        action: "archive",
        version: 1,
      }).success,
    ).toBe(true);
    expect(
      threadStateSchema.safeParse({
        threadId: "00000000-0000-4000-8000-000000000001",
        action: "destroy",
        version: 0,
      }).success,
    ).toBe(false);
  });
});
