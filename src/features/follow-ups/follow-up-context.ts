import type { FollowUpClientOption } from "@/features/follow-ups/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEYS = ["clientId", "contactId", "enquiryId", "projectId"] as const;

export type FollowUpContextParams = Partial<Record<(typeof KEYS)[number], string | string[]>>;

export type FollowUpContext = {
  clientId: string;
  contactId: string;
  enquiryId: string;
  projectId: string;
  /** Calm, form-level explanation shown when the link could not be used. */
  notice?: string;
};

export const CONTEXT_NOTICE =
  "We couldn't use the details from that link, so nothing has been pre-filled. You can fill in the form yourself.";

const EMPTY: FollowUpContext = { clientId: "", contactId: "", enquiryId: "", projectId: "" };

/**
 * Turns untrusted `?clientId=&contactId=&enquiryId=&projectId=` query values
 * into form defaults. A value is only used when it names a record that
 * actually exists in the server-loaded options AND belongs to the named
 * client; any malformed, unknown or inconsistent combination yields no
 * defaults at all plus a calm notice, never a partial or wrong pre-fill.
 */
export function resolveFollowUpContext(
  params: FollowUpContextParams,
  clients: FollowUpClientOption[],
): FollowUpContext {
  const supplied = KEYS.filter((key) => params[key] !== undefined && params[key] !== "");
  if (supplied.length === 0) return EMPTY;
  const invalid = { ...EMPTY, notice: CONTEXT_NOTICE };

  const values = { ...EMPTY } as Record<(typeof KEYS)[number], string>;
  for (const key of supplied) {
    const raw = params[key];
    if (typeof raw !== "string" || !UUID_RE.test(raw)) return invalid;
    values[key] = raw;
  }

  const client = clients.find((option) => option.id === values.clientId);
  if (!client) return invalid;
  if (values.contactId && !client.contacts.some((item) => item.id === values.contactId))
    return invalid;
  if (values.enquiryId && !client.enquiries.some((item) => item.id === values.enquiryId))
    return invalid;
  if (values.projectId && !client.projects.some((item) => item.id === values.projectId))
    return invalid;
  if (values.enquiryId && values.projectId) return invalid;
  return values;
}
