import "server-only";
import { cache } from "react";
import { fetchRelatedFollowUps } from "@/features/follow-ups/fetch-related-follow-ups";
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
        "id, full_name, company, email, phone, project_type, location, timeline, description, budget, status, source, created_at, client_id, archived",
      )
      .eq("id", id)
      .maybeSingle();
    if (enquiryError) throw enquiryError;
    if (!enquiry) return { status: "not-found" };

    const [
      { data: attachmentRows, error: attachmentsError },
      { data: activityRows, error: activityError },
      { data: projectRow, error: projectError },
      { data: clientRow, error: clientError },
      followUps,
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
      supabase.from("projects").select("id, name, status").eq("enquiry_id", id).maybeSingle(),
      enquiry.client_id
        ? supabase.from("clients").select("archived").eq("id", enquiry.client_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      fetchRelatedFollowUps("enquiry_id", id),
    ]);
    if (attachmentsError) throw attachmentsError;
    if (activityError) throw activityError;
    if (projectError) throw projectError;
    if (clientError) throw clientError;
    // An unavailable follow-ups query must not read as "no follow-ups": that would hide real
    // work, so it fails the page like any other required child query.
    if (!followUps) throw new Error("Follow-ups are unavailable");

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
        new Date(),
        projectRow,
        followUps,
        clientRow?.archived === true,
      ),
    };
  } catch (error) {
    console.error("Could not load enquiry", id, error);
    return { status: "error" };
  }
});
