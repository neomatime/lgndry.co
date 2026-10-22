import { z } from "zod";

export const profileInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your full name.")
    .max(120, "Use 120 characters or fewer."),
});

export const passwordInputSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters.").max(128),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match.",
  });
