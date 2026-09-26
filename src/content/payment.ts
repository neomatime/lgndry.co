// Payment options offered at checkout.

/**
 * Card payment is not live yet (the provider integration is a later phase), so
 * the option is shown greyed out as "Coming soon". Flip this only together with
 * server-side support: the order action refuses any method it doesn't know.
 */
export const CARD_PAYMENT_ENABLED = false;
