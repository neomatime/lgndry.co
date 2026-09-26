import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AccountApp,
  type AccountProfile,
} from "@/features/customer-account/components/account-app";
import { ACCOUNT_ORDER_COLUMNS, type AccountOrder } from "@/features/customer-account/orders";
import { createSupabaseServerClient } from "@/lib/db/server";

export const metadata: Metadata = {
  title: { absolute: "My Account — LGNDRY.Co" },
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?mode=login&next=%2Faccount");
  if (!user.email_confirmed_at) {
    redirect(`/auth?mode=verify&email=${encodeURIComponent(user.email ?? "")}`);
  }

  // Read as the customer, so row-level security limits this to their own data.
  const [profile, orders] = await Promise.all([
    supabase.from("customer_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select(ACCOUNT_ORDER_COLUMNS)
      .order("submittedAt", { ascending: false }),
  ]);
  const failure = profile.error ?? orders.error;
  if (failure) console.error("account: could not load", failure.message);

  return (
    <AccountApp
      user={{
        id: user.id,
        email: user.email ?? "",
        fullName: (user.user_metadata as { full_name?: string } | null)?.full_name ?? "",
      }}
      profile={(profile.data as AccountProfile | null) ?? null}
      orders={(orders.data as unknown as AccountOrder[] | null) ?? []}
      loadError={failure ? failure.message : undefined}
    />
  );
}
