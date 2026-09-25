// Budget dropdown options for the public forms.
//
// Seeded from the live `budgets` table on 2026-09-25. The legacy site loaded
// these at runtime and overwrote the static HTML options with them, so these —
// not the HTML's original wording — are what visitors currently see.
// They are static now because the old admin's content editing is being
// retired; edit them here.

export const BUDGET_PLACEHOLDER = "Select budget range";

export const CONTACT_BUDGETS = [
  "From R5,000 - R15,000",
  "R15,000 - R35,000",
  "R35,000+",
  "Not sure yet",
] as const;

export const BOOKING_BUDGETS = ["From R6,500 - R10,000", "R10,000 - R25,000", "R25,000+"] as const;

export const PARTNERSHIP_BUDGETS = [
  "R10,000 - R25,000 / month",
  "R25,000 - R50,000 / month",
  "R50,000+ / month",
  "To be discussed",
] as const;
