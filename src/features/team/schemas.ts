import { z } from "zod";

export const inviteTeamMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export const removeTeamMemberSchema = z.object({
  userId: z.string().uuid("Select a valid team member."),
});
