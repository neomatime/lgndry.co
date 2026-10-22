import "server-only";

import { z } from "zod";
import type { TeamFetchResult } from "@/features/team/types";
import { createSupabaseServerClient } from "@/lib/db/server";

const responseSchema = z.object({
  users: z.array(
    z.object({
      id: z.string().uuid(),
      email: z.string(),
      is_you: z.boolean(),
    }),
  ),
});

export async function fetchOpsTeam(): Promise<TeamFetchResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.functions.invoke("manage-team", {
      body: { action: "list" },
    });
    if (error) throw error;
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success) throw new Error("The team service returned an invalid response.");
    return {
      status: "ok",
      members: parsed.data.users.map((user) => ({
        id: user.id,
        email: user.email,
        isYou: user.is_you,
      })),
    };
  } catch (error) {
    console.error("Could not load OPS team", error);
    return { status: "error" };
  }
}
