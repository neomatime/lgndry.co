import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";
import { buildEnquiryListItems, type EnquiryListItem } from "@/features/enquiries/list-view-model";

/**
 * Every enquiry with its attachment count, newest first, or `null` when it
 * can't be loaded (so the page can show a distinct "temporarily unavailable"
 * state instead of an error) -- matches the established convention in
 * src/features/shop/catalogue/data.ts's fetchCollection.
 */
export async function fetchEnquiries(): Promise<EnquiryListItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: enquiries, error: enquiriesError }, { data: attachments, error: attachmentsError }] =
      await Promise.all([
        supabase
          .from("enquiries")
          .select(
            "id, full_name, company, email, phone, project_type, location, timeline, description, budget, status, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("enquiry_attachments").select("enquiry_id"),
      ]);
    if (enquiriesError) throw enquiriesError;
    if (attachmentsError) throw attachmentsError;

    const attachmentCounts = new Map<string, number>();
    for (const attachment of (attachments ?? []) as { enquiry_id: string }[]) {
      attachmentCounts.set(attachment.enquiry_id, (attachmentCounts.get(attachment.enquiry_id) ?? 0) + 1);
    }

    return buildEnquiryListItems(enquiries ?? [], attachmentCounts);
  } catch (error) {
    console.error("Could not load enquiries", error);
    return null;
  }
}
