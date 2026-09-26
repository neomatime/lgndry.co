/** Where a customer lands after signing in when nothing else was asked for. */
export const DEFAULT_LANDING = "/account#orders";

/**
 * The page to send a customer to after signing in. Only same-site paths are
 * accepted; anything else (absolute URLs, protocol-relative `//host`,
 * backslash tricks) falls back to the account page, so the sign-in page can't
 * be used as an open redirect. (The legacy check accepted `//host`.)
 */
export function safeCustomerNext(next: string | null | undefined): string {
  if (!next) return DEFAULT_LANDING;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return DEFAULT_LANDING;
  }
  return next;
}

/**
 * Where Supabase sends the customer back to after email verification,
 * password recovery or Google sign-in. Kept as the `.html` address the
 * project's redirect allow-list already contains; the site redirects it to the
 * clean URL, keeping the query string and fragment.
 */
export function authCallbackUrl(origin: string): string {
  return `${origin}/auth-callback.html`;
}
