import "server-only";
import { cache } from "react";
import { buildEnquiryDetail, type EnquiryDetail } from "@/features/enquiries/detail-view-model";
import { createSupabaseServerClient } from "@/lib/db/server";

const BUCKET = "enquiry-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EnquiryDetailResult =
  { status: "ok"; enquiry: EnquiryDetail } | { status: "not-found" } | { status: "error" };

export const fetchEnquiryDetail = cache(async (id: string): Promise<EnquiryDetailResult> => {
  if (!UUID_RE.test(id)) return { status: "not-found" };
  try {
    const supabase = await createSupabaseServerClient();
    const { data: enquiry, error: enquiryError } = await supabase
      .from("enquiries")
      .select(
        "id, full_name, company, email, phone, project_type, location, timeline, description, budget, status, source, created_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (enquiryError) throw enquiryError;
    if (!enquiry) return { status: "not-found" };

    const [
      { data: attachmentRows, error: attachmentsError },
      { data: activityRows, error: activityError },
    ] = await Promise.all([
      supabase
        .from("enquiry_attachments")
        .select("file_name, storage_path, size_bytes")
        .eq("enquiry_id", id),
      supabase
        .from("ops_activity_log")
        .select("id, message, created_at")
        .eq("collection", "enquiries")
        .eq("record_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (attachmentsError) throw attachmentsError;
    if (activityError) throw activityError;

    const signedUrlByPath = new Map<string, string | null>();
    for (const row of (attachmentRows ?? []) as { storage_path: string }[]) {
      const { data: signed, error: signedUrlError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      if (signedUrlError) {
        console.error("Could not sign attachment URL", row.storage_path, signedUrlError.message);
      }
      signedUrlByPath.set(row.storage_path, signed?.signedUrl ?? null);
    }

    return {
      status: "ok",
      enquiry: buildEnquiryDetail(
        enquiry,
        attachmentRows ?? [],
        signedUrlByPath,
        activityRows ?? [],
      ),
    };
  } catch (error) {
    console.error("Could not load enquiry", id, error);
    return { status: "error" };
  }
});
