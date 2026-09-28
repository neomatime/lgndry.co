import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const BUCKET = "enquiry-attachments";
const BATCH_SIZE = 50;

type ExpiredSession = {
  id: string;
  file_manifest: unknown;
};

function storagePaths(session: ExpiredSession) {
  if (!Array.isArray(session.file_manifest)) return null;

  const prefix = `${session.id}/`;
  const paths: string[] = [];

  for (const entry of session.file_manifest) {
    if (!entry || typeof entry !== "object" || !("storage_path" in entry)) return null;

    const path = String((entry as Record<string, unknown>).storage_path);
    if (!path.startsWith(prefix)) return null;
    paths.push(path);
  }

  return paths;
}

function defaultSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeys) return null;

  try {
    const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
    return typeof parsed.default === "string" ? parsed.default : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = defaultSecretKey();
  if (!url || !secretKey) {
    return new Response("Not configured", { status: 500 });
  }

  if (request.headers.get("apikey") !== secretKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await supabase.rpc("list_expired_enquiry_upload_sessions", {
      p_limit: BATCH_SIZE,
    });
    if (error) throw error;

    const sessions = (data ?? []) as ExpiredSession[];
    let cleaned = 0;
    let failed = 0;

    for (const session of sessions) {
      const paths = storagePaths(session);
      if (!paths) {
        failed += 1;
        console.error("cleanup: invalid manifest", session.id);
        continue;
      }

      const removeResult = paths.length
        ? await supabase.storage.from(BUCKET).remove(paths)
        : { error: null };
      if (removeResult.error) {
        failed += 1;
        console.error("cleanup: remove failed", session.id);
        continue;
      }

      const markResult = await supabase.rpc("mark_enquiry_upload_session_expired", {
        p_session_id: session.id,
      });
      if (markResult.error || markResult.data !== true) {
        failed += 1;
        console.error("cleanup: mark failed", session.id);
        continue;
      }

      cleaned += 1;
    }

    return Response.json({ scanned: sessions.length, cleaned, failed });
  } catch {
    console.error("cleanup: batch failed");
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
});
