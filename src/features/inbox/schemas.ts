import { z } from "zod";

export const threadStateSchema = z.object({
  threadId: z.uuid(),
  action: z.enum(["mark-read", "mark-unread", "star", "unstar", "archive", "restore", "trash"]),
  version: z.number().int().positive(),
});

export const draftSchema = z.object({
  emailId: z.uuid().nullable().optional(),
  threadId: z.uuid().nullable().optional(),
  version: z.number().int().positive().nullable().optional(),
  toEmail: z.email("Enter a valid recipient email."),
  toName: z.string().trim().max(120).optional(),
  cc: z.string().trim().max(500).optional(),
  bcc: z.string().trim().max(500).optional(),
  subject: z.string().trim().min(1, "Add a subject.").max(250),
  body: z.string().trim().min(1, "Write a message.").max(100000),
  intent: z.enum(["draft", "send"]),
});

export const threadLinksSchema = z.object({
  threadId: z.uuid(),
  version: z.number().int().positive(),
  clientId: z.uuid().nullable(),
  contactId: z.uuid().nullable(),
  enquiryId: z.uuid().nullable(),
  projectId: z.uuid().nullable(),
  quoteId: z.uuid().nullable(),
  invoiceId: z.uuid().nullable(),
  followUpId: z.uuid().nullable(),
});

export const attachmentUploadSchema = z.object({
  draft: draftSchema.omit({ intent: true }),
  file: z.object({
    name: z.string().trim().min(1).max(255),
    type: z.enum([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]),
    size: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024),
  }),
});
