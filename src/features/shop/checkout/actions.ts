"use server";

import { fetchCollection } from "@/features/shop/catalogue/data";
import { priceOrder } from "@/features/shop/checkout/order";
import { orderActivity, orderRecord, type OrderRecord } from "@/features/shop/checkout/records";
import { placeOrderSchema } from "@/features/shop/checkout/schema";
import { createSupabaseAnonClient } from "@/lib/db/anon";
import { createSupabaseServerClient } from "@/lib/db/server";

export type PlaceOrderResult = { ok: true; order: OrderRecord } | { ok: false; error: string };

const INVALID: PlaceOrderResult = {
  ok: false,
  error: "Some details look incomplete. Please check the form and try again.",
};
const FAILED: PlaceOrderResult = {
  ok: false,
  error: "We could not submit your order. Please try again or contact the studio.",
};

/** Postgres "unique violation": the order number was already taken. */
const UNIQUE_VIOLATION = "23505";
const ATTEMPTS = 3;

/**
 * Places an order. Everything that matters is decided here, not in the browser:
 * prices, stock and totals are recomputed from the collection, so a tampered
 * cart can't change what is charged. The order is written as the visitor (row
 * level security still applies): a signed-in customer with a confirmed email
 * gets it linked to their account; anyone else places it as a guest.
 */
export async function placeOrder(payload: unknown): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(payload);
  if (!parsed.success) return INVALID;
  const input = parsed.data;
  if (input.hp_website) return INVALID; // bot: nothing is stored, and no order comes back

  const products = await fetchCollection();
  if (!products) return FAILED;
  const priced = priceOrder({
    lines: input.lines,
    products,
    requestOnly: input.requestOnly,
    deliveryMethod: input.deliveryMethod,
  });
  if (!priced.ok) return { ok: false, error: priced.error };

  const session = await createSupabaseServerClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  const customer =
    user && user.email_confirmed_at
      ? {
          id: user.id,
          email: user.email,
          fullName: (user.user_metadata as { full_name?: string } | null)?.full_name,
        }
      : undefined;

  // A signed-in visitor whose email isn't confirmed is neither a guest nor a
  // customer as far as the database policies go, so they order as a guest.
  const supabase = customer ? session : createSupabaseAnonClient();

  const submittedAt = new Date().toISOString();
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const order = orderRecord(input, priced, {
      id: crypto.randomUUID(),
      submittedAt,
      suffix: crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000,
      customer,
    });
    const { error } = await supabase.from("orders").insert(order);
    if (!error) {
      // The order is safely stored; a failed log entry must not fail it.
      await supabase.from("ops_activity_log").insert({ message: orderActivity(order) });
      return { ok: true, order };
    }
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("checkout: order insert failed:", error.message);
      return FAILED;
    }
  }
  console.error("checkout: could not find a free order number");
  return FAILED;
}
