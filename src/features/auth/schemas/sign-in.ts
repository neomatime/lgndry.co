import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1),
  next: z.string().optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

const DEFAULT_LANDING = "/ops";

/**
 * Only same-site paths inside /ops are valid post-login destinations.
 * Anything else (absolute URLs, protocol-relative `//host`, backslash tricks,
 * other site sections) falls back to the OPS home, which prevents the login
 * page being used as an open redirect.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_LANDING;
  if (!next.startsWith("/ops")) return DEFAULT_LANDING;
  if (next.startsWith("//") || next.includes("\\")) return DEFAULT_LANDING;
  const afterPrefix = next.charAt(4);
  if (afterPrefix !== "" && afterPrefix !== "/" && afterPrefix !== "?" && afterPrefix !== "#") {
    return DEFAULT_LANDING;
  }
  return next;
}
