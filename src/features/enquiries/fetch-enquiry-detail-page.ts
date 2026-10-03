import "server-only";
import { cache } from "react";
import type { EnquiryDetail } from "@/features/enquiries/detail-view-model";
import { fetchEnquiryDetail } from "@/features/enquiries/fetch-enquiry-detail";
import { fetchRelatedFollowUps } from "@/features/follow-ups/fetch-related-follow-ups";
import {
  buildParentFollowUps,
  type ParentFollowUps,
} from "@/features/follow-ups/related-view-model";
import { createSupabaseServerClient } from "@/lib/db/server";

export type EnquiryDetailPageResult =
  | { status: "ok"; enquiry: EnquiryDetail; followUps: ParentFollowUps }
  | { status: "not-found" }
  | { status: "error" };

/**
 * The enquiry DETAIL page's loader: the plain enquiry detail plus its follow-ups, its client
 * link (legacy enquiries may have none) and whether the enquiry or its client is archived
 * (the follow-up form can't pre-fill archived records). Kept apart from `fetchEnquiryDetail`
 * so the edit page neither pays for these queries nor fails when they are unavailable.
 * Nothing extra is requested unless the enquiry exists, and an unavailable query fails the
 * page rather than reading as "no follow-ups".
 */
export const fetchEnquiryDetailPage = cache(
  async (id: string): Promise<EnquiryDetailPageResult> => {
    const result = await fetchEnquiryDetail(id);
    if (result.status !== "ok") return result;

    try {
      const supabase = await createSupabaseServerClient();
      const [rows, linkResult] = await Promise.all([
        fetchRelatedFollowUps("enquiry_id", id),
        supabase.from("enquiries").select("client_id, archived").eq("id", id).maybeSingle(),
      ]);
      if (!rows) return { status: "error" };
      if (linkResult.error) throw linkResult.error;
      const link = linkResult.data as { client_id?: string | null; archived?: boolean } | null;
      const clientId = link?.client_id ?? null;

      let clientArchived = false;
      if (clientId) {
        const clientResult = await supabase
          .from("clients")
          .select("archived")
          .eq("id", clientId)
          .maybeSingle();
        if (clientResult.error) throw clientResult.error;
        clientArchived = (clientResult.data as { archived?: boolean } | null)?.archived === true;
      }

      return {
        status: "ok",
        enquiry: result.enquiry,
        followUps: buildParentFollowUps(rows, new Date(), {
          archived: link?.archived === true,
          clientId,
          clientArchived,
        }),
      };
    } catch (error) {
      console.error("Could not load enquiry follow-up context", id, error);
      return { status: "error" };
    }
  },
);
