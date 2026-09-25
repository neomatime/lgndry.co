import "server-only";
import { redirect } from "next/navigation";
import { resolveOpsAccess, type OpsUser } from "@/lib/auth/server";

/**
 * Call at the top of any OPS layout, page or server action. Never rely on
 * hiding UI: every privileged entry point re-checks access on the server.
 */
export async function requireOpsUser(): Promise<OpsUser> {
  const access = await resolveOpsAccess();
  if (access.status === "anonymous") redirect("/auth/login");
  if (access.status === "forbidden") redirect("/auth/login?error=forbidden");
  return access.user;
}
