// Contact details and mailto links used across the public site.

export const CONTACT_EMAIL = "neomokgwadi@lgndry-co.co.za";
export const PHONE_DISPLAY = "076 486 2725";
export const PHONE_HREF = "tel:+27764862725";

/** A mailto link with a pre-filled subject (already URL-encoded by the caller's string). */
export function mailto(encodedSubject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodedSubject}`;
}
