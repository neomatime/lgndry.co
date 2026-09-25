import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";

export type OpsUser = {
  id: string;
  email: string;
  name: string;
};

export type OpsAccess =
  { status: "anonymous" } | { status: "forbidden" } | { status: "ok"; user: OpsUser };

/**
 * Resolves who is making the current request and whether they may use OPS.
 *
 * Identity is verified with the Auth server (`getUser`), not just the cookie.
 * Membership uses the same rule as the legacy admin: a row in `admin_users`,
 * which row-level security only exposes to admins (is_admin(auth.uid())), so
 * a non-admin simply reads no rows.
 */
export async function resolveOpsAccess(): Promise<OpsAccess> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const { data: membership } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!membership) return { status: "forbidden" };

  const email = data.user.email ?? "";
  const metadataName = data.user.user_metadata?.full_name;
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : email.split("@")[0] || "Admin";

  return { status: "ok", user: { id: data.user.id, email, name } };
}
