import "server-only";
import { cache } from "react";
import type { ClientDetail } from "@/features/clients/detail-view-model";
import { fetchClientDetail } from "@/features/clients/fetch-client-detail";
import { fetchRelatedFollowUps } from "@/features/follow-ups/fetch-related-follow-ups";
import {
  buildParentFollowUps,
  type ParentFollowUps,
} from "@/features/follow-ups/related-view-model";

export type ClientDetailPageResult =
  | { status: "ok"; client: ClientDetail; followUps: ParentFollowUps }
  | { status: "not-found" }
  | { status: "error" };

/**
 * The client DETAIL page's loader: the plain client detail plus its follow-ups. Kept apart
 * from `fetchClientDetail` so the edit page, which never shows follow-ups, neither pays for
 * the query nor fails when it is unavailable. Follow-ups are only requested once the client
 * is known to exist, and an unavailable follow-ups query fails the page (never an empty list).
 */
export const fetchClientDetailPage = cache(async (id: string): Promise<ClientDetailPageResult> => {
  const result = await fetchClientDetail(id);
  if (result.status !== "ok") return result;

  const rows = await fetchRelatedFollowUps("client_id", id);
  if (!rows) return { status: "error" };
  const { client } = result;
  return {
    status: "ok",
    client,
    followUps: buildParentFollowUps(rows, new Date(), {
      archived: client.archived,
      clientId: client.id,
      clientArchived: client.archived,
    }),
  };
});
