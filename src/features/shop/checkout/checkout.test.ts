import { beforeEach, describe, expect, it, vi } from "vitest";
import { artworkFromRow, type Artwork } from "@/features/shop/catalogue/artwork";
import {
  orderNumber,
  paymentStatusFor,
  priceOrder,
  type RequestedLine,
} from "@/features/shop/checkout/order";
import { orderActivity, orderRecord } from "@/features/shop/checkout/records";
import { COLLECT, DELIVER, placeOrderSchema } from "@/features/shop/checkout/schema";

const work = (over: Record<string, unknown> = {}): Artwork =>
  artworkFromRow({
    id: "a",
    title: "Alpha",
    price: 20000,
    availability: "Available",
    remaining: 3,
    editionSize: 15,
    image: "assests/images/a.jpg",
    sizes: "50 × 70 cm",
    ...over,
  });

const ALPHA = work();
const SOLD_OUT = work({ id: "s", title: "Sold", availability: "Sold Out", remaining: 0 });
const BY_REQUEST = work({ id: "r", title: "Rare", requiresConfirmation: true });

const line = (over: Partial<RequestedLine> = {}): RequestedLine => ({
  artworkId: "a",
  size: "50 × 70 cm",
  framing: "Unframed / Unframed",
  quantity: 1,
  requiresConfirmation: false,
  ...over,
});

const price = (lines: RequestedLine[], over: { requestOnly?: boolean; method?: string } = {}) =>
  priceOrder({
    lines,
    products: [ALPHA, SOLD_OUT, BY_REQUEST],
    requestOnly: over.requestOnly ?? false,
    deliveryMethod: over.method ?? DELIVER,
  });

describe("priceOrder", () => {
  it("prices from the collection, ignoring anything the browser claims", () => {
    const result = price([line({ quantity: 2 })]);
    expect(result).toMatchObject({
      ok: true,
      orderType: "Direct Purchase",
      subtotal: 40000,
      deliveryFee: 250,
      grandTotal: 40250,
      quantity: 2,
      itemSummary: "2 x Alpha (50 × 70 cm)",
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.items[0]).toMatchObject({
      artworkId: "a",
      title: "Alpha",
      price: 20000,
      unitPrice: 20000,
      lineTotal: 40000,
      framing: "Unframed / Unframed",
    });
  });

  it("waives the delivery fee for collection", () => {
    expect(price([line()], { method: COLLECT })).toMatchObject({
      deliveryFee: 0,
      grandTotal: 20000,
    });
  });

  it("rejects a work that has left the collection", () => {
    expect(price([line({ artworkId: "gone" })])).toMatchObject({ ok: false });
  });

  it("won't sell a direct purchase of something unavailable", () => {
    const result = price([line({ artworkId: "s" })]);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.error).toContain("Sold");
  });

  it("won't sell more than remain", () => {
    const result = price([line({ quantity: 4 })]);
    expect(result.ok === false && result.error).toContain("Only 3 of Alpha remain");
  });

  it("turns into an order request for a request-only work, or when asked", () => {
    expect(price([line({ artworkId: "r" })])).toMatchObject({
      ok: true,
      orderType: "Order Request",
    });
    expect(price([line()], { requestOnly: true })).toMatchObject({ orderType: "Order Request" });
    expect(price([line({ requiresConfirmation: true })])).toMatchObject({
      orderType: "Order Request",
    });
  });

  it("lets a request include unavailable works, one unit at a time", () => {
    const result = price([line({ artworkId: "s", quantity: 5 })], { requestOnly: true });
    expect(result).toMatchObject({ ok: true, quantity: 1 });
  });
});

describe("orderNumber / paymentStatusFor", () => {
  it("formats the date and pads the suffix", () => {
    expect(orderNumber("2026-09-26T10:00:00.000Z", 4217)).toBe("ORD-20260926-004217");
  });

  it("awaits payment only for direct purchases", () => {
    expect(paymentStatusFor("Direct Purchase")).toBe("Awaiting Payment");
    expect(paymentStatusFor("Order Request")).toBe("Not Required");
  });
});

const input = (over: Record<string, unknown> = {}) =>
  placeOrderSchema.parse({
    customerName: "Thandi Mokoena",
    customerEmail: "thandi@example.com",
    customerPhone: "0761234567",
    deliveryMethod: DELIVER,
    deliveryAddress: "1 Main Rd",
    deliveryCity: "Polokwane",
    postalCode: "0700",
    billingSame: true,
    paymentMethod: "EFT",
    lines: [{ artworkId: "a", quantity: 1 }],
    ...over,
  });

describe("placeOrderSchema", () => {
  it("accepts a complete delivery order", () => {
    expect(input().deliveryCity).toBe("Polokwane");
  });

  it("needs an address only when delivering", () => {
    const missing = { deliveryAddress: "", deliveryCity: "", postalCode: "" };
    expect(() => input(missing)).toThrow();
    expect(() => input({ ...missing, deliveryMethod: COLLECT })).not.toThrow();
  });

  it("needs billing details only when they differ", () => {
    expect(() => input({ billingSame: false })).toThrow();
    expect(() =>
      input({
        billingSame: false,
        billingName: "B",
        billingAddress: "A",
        billingCity: "C",
        billingPostalCode: "1",
      }),
    ).not.toThrow();
  });

  it("refuses card payment, a bad email, an empty cart and huge quantities", () => {
    expect(() => input({ paymentMethod: "Debit / Credit Card" })).toThrow();
    expect(() => input({ customerEmail: "nope" })).toThrow();
    expect(() => input({ lines: [] })).toThrow();
    expect(() => input({ lines: [{ artworkId: "a", quantity: 1000 }] })).toThrow();
  });
});

describe("orderRecord", () => {
  const priced = (() => {
    const result = price([line()]);
    if (!result.ok) throw new Error("expected ok");
    return result;
  })();
  const meta = { id: "id-1", submittedAt: "2026-09-26T10:00:00.000Z", suffix: 7 };

  it("writes the legacy row", () => {
    expect(orderRecord(input(), priced, meta)).toMatchObject({
      id: "id-1",
      orderNumber: "ORD-20260926-000007",
      customerName: "Thandi Mokoena",
      customerEmail: "thandi@example.com",
      customerPhone: "0761234567",
      quantity: 1,
      subtotal: 20000,
      deliveryFee: 250,
      grandTotal: 20250,
      orderType: "Direct Purchase",
      paymentMethod: "EFT",
      paymentStatus: "Awaiting Payment",
      fulfilmentStatus: "Awaiting Confirmation",
      deliveryMethod: DELIVER,
      deliveryAddress: "1 Main Rd",
      billingName: "Thandi Mokoena",
      billingAddress: "1 Main Rd",
      status: "New",
    });
  });

  it("fills placeholder address text for collection", () => {
    const record = orderRecord(
      input({ deliveryMethod: COLLECT, deliveryAddress: "", deliveryCity: "", postalCode: "" }),
      priced,
      meta,
    );
    expect(record).toMatchObject({
      deliveryAddress: "Collection from LGNDRY.Co",
      deliveryCity: "Collection",
      postalCode: "N/A",
      billingAddress: "Collection from LGNDRY.Co",
      billingCity: "Collection",
      billingPostalCode: "N/A",
    });
  });

  it("uses the separate billing details when given", () => {
    const record = orderRecord(
      input({
        billingSame: false,
        billingName: "Acme",
        billingAddress: "9 Rd",
        billingCity: "Jhb",
        billingPostalCode: "2000",
      }),
      priced,
      meta,
    );
    expect(record).toMatchObject({
      billingName: "Acme",
      billingAddress: "9 Rd",
      billingCity: "Jhb",
      billingPostalCode: "2000",
    });
  });

  it("links a confirmed customer's account and prefers their own name and email", () => {
    const record = orderRecord(input(), priced, {
      ...meta,
      customer: { id: "user-1", email: "account@example.com", fullName: "T. Mokoena" },
    });
    expect(record).toMatchObject({
      customer_id: "user-1",
      customerEmail: "account@example.com",
      customerName: "T. Mokoena",
    });
  });

  it("leaves customer_id off for a guest", () => {
    expect(orderRecord(input(), priced, meta)).not.toHaveProperty("customer_id");
  });

  it("logs a short activity line", () => {
    expect(
      orderActivity({ orderType: "Order Request", orderNumber: "ORD-1", customerName: "" }),
    ).toBe("New order request ORD-1 from website visitor");
    expect(
      orderActivity({
        orderType: "Direct Purchase",
        orderNumber: "ORD-1",
        customerName: "x".repeat(300),
      }).length,
    ).toBe(200);
  });
});

// ── the server action, with the database and collection replaced ────────────

const inserted: { table: string; row: Record<string, unknown> }[] = [];
let insertError: { code?: string; message: string } | null = null;
let insertErrors: ({ code?: string; message: string } | null)[] = [];
let sessionUser: {
  id: string;
  email: string;
  email_confirmed_at?: string;
  user_metadata?: object;
} | null = null;
let collection: Artwork[] | null = [ALPHA];
const anonInsert = vi.fn();

function fakeClient(kind: "session" | "anon") {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserted.push({ table, row });
        if (kind === "anon") anonInsert(table);
        const error = table === "orders" ? (insertErrors.shift() ?? insertError) : null;
        return { error };
      },
    }),
  };
}

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => fakeClient("session"),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => fakeClient("anon") }));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
  }),
}));
vi.mock("@/features/shop/catalogue/data", () => ({ fetchCollection: async () => collection }));

const rawInput = (over: Record<string, unknown> = {}) => ({
  customerName: "Thandi Mokoena",
  customerEmail: "thandi@example.com",
  customerPhone: "0761234567",
  deliveryMethod: DELIVER,
  deliveryAddress: "1 Main Rd",
  deliveryCity: "Polokwane",
  postalCode: "0700",
  billingSame: true,
  paymentMethod: "EFT",
  requestOnly: false,
  lines: [
    {
      artworkId: "a",
      size: "50 × 70 cm",
      framing: "Unframed / Unframed",
      quantity: 1,
      requiresConfirmation: false,
    },
  ],
  ...over,
});

describe("placeOrder", () => {
  beforeEach(() => {
    inserted.length = 0;
    insertError = null;
    insertErrors = [];
    sessionUser = null;
    collection = [ALPHA];
    anonInsert.mockClear();
  });

  it("stores a guest order priced from the collection and logs it", async () => {
    const { placeOrder } = await import("@/features/shop/checkout/actions");
    // A tampered cart claiming a price of 1 cannot change what is charged.
    const result = await placeOrder({
      ...rawInput(),
      lines: [{ ...rawInput().lines[0], price: 1 }],
    });

    expect(result.ok).toBe(true);
    const order = inserted.find((i) => i.table === "orders")!.row;
    expect(order).toMatchObject({ subtotal: 20000, grandTotal: 20250, status: "New" });
    expect(order).not.toHaveProperty("customer_id");
    expect(inserted.map((i) => i.table)).toEqual(["orders", "ops_activity_log"]);
    expect(anonInsert).toHaveBeenCalled(); // written as an anonymous visitor
  });

  it("links a confirmed customer's order to their account", async () => {
    sessionUser = {
      id: "u1",
      email: "acc@example.com",
      email_confirmed_at: "2026-01-01",
      user_metadata: { full_name: "Acc Name" },
    };
    const { placeOrder } = await import("@/features/shop/checkout/actions");
    await placeOrder(rawInput());
    expect(inserted.find((i) => i.table === "orders")!.row).toMatchObject({
      customer_id: "u1",
      customerEmail: "acc@example.com",
      customerName: "Acc Name",
    });
    expect(anonInsert).not.toHaveBeenCalled();
  });

  it("treats a signed-in visitor with an unconfirmed email as a guest", async () => {
    sessionUser = { id: "u2", email: "new@example.com" };
    const { placeOrder } = await import("@/features/shop/checkout/actions");
    await placeOrder(rawInput());
    expect(inserted.find((i) => i.table === "orders")!.row).not.toHaveProperty("customer_id");
    expect(anonInsert).toHaveBeenCalled();
  });

  it("stores nothing for bad input, a honeypot hit or an unavailable work", async () => {
    const { placeOrder } = await import("@/features/shop/checkout/actions");
    expect(await placeOrder({ nope: true })).toMatchObject({ ok: false });
    expect(await placeOrder({ ...rawInput(), hp_website: "http://spam" })).toMatchObject({
      ok: false,
    });
    collection = [work({ availability: "Sold Out", remaining: 0 })];
    expect(await placeOrder(rawInput())).toMatchObject({ ok: false });
    expect(inserted).toEqual([]);
  });

  it("fails cleanly when the collection can't be read", async () => {
    collection = null;
    const { placeOrder } = await import("@/features/shop/checkout/actions");
    expect(await placeOrder(rawInput())).toMatchObject({ ok: false });
    expect(inserted).toEqual([]);
  });

  it("retries with a new number when the order number is taken", async () => {
    insertErrors = [{ code: "23505", message: "duplicate" }, null];
    const { placeOrder } = await import("@/features/shop/checkout/actions");
    const result = await placeOrder(rawInput());
    expect(result.ok).toBe(true);
    expect(inserted.filter((i) => i.table === "orders")).toHaveLength(2);
  });

  it("gives up cleanly on any other database error, without logging activity", async () => {
    insertError = { code: "42501", message: "rls" };
    const { placeOrder } = await import("@/features/shop/checkout/actions");
    expect(await placeOrder(rawInput())).toMatchObject({ ok: false });
    expect(inserted.map((i) => i.table)).toEqual(["orders"]);
  });
});
