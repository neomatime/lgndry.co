import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.lgndry-co.co.za",
  "https://lgndry-co.co.za",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.lgndry-co.co.za",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !serviceKey || !authorization) {
      return json(request, { error: "Unauthorized" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    const caller = callerData.user;
    if (callerError || !caller) return json(request, { error: "Unauthorized" }, 401);

    const { data: membership, error: membershipError } = await serviceClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (membershipError || !membership) return json(request, { error: "Admin access required" }, 403);

    const body = await request.json();
    const action = String(body.action || "");

    if (action === "list") {
      const { data: memberships, error } = await serviceClient
        .from("admin_users")
        .select("user_id, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const users = await Promise.all((memberships || []).map(async (entry) => {
        const { data } = await serviceClient.auth.admin.getUserById(entry.user_id);
        if (!data.user) return null;
        return {
          id: data.user.id,
          email: data.user.email || "Unknown email",
          is_you: data.user.id === caller.id,
        };
      }));
      return json(request, { users: users.filter(Boolean) });
    }

    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || password.length < 8) {
        return json(request, { error: "Enter a valid email and a password of at least 8 characters." }, 400);
      }

      const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { account_type: "admin" },
      });
      if (createError || !created.user) {
        return json(request, { error: createError?.message || "Could not create team member" }, 400);
      }

      const { error: roleError } = await serviceClient
        .from("admin_users")
        .insert({ user_id: created.user.id });
      if (roleError) {
        await serviceClient.auth.admin.deleteUser(created.user.id);
        throw roleError;
      }
      return json(request, { user: { id: created.user.id, email: created.user.email } }, 201);
    }

    if (action === "remove") {
      const userId = String(body.userId || "");
      if (!userId) return json(request, { error: "A team member is required." }, 400);
      if (userId === caller.id) return json(request, { error: "You cannot remove your own access." }, 400);

      const { error } = await serviceClient.from("admin_users").delete().eq("user_id", userId);
      if (error) throw error;
      return json(request, { removed: true });
    }

    return json(request, { error: "Unknown action" }, 400);
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : "Unable to manage team" }, 400);
  }
});
