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
    const { data: enquiries, error: enquiriesError } = await supabase
      .from("enquiries")
      .select(
        "id, full_name, company, email, phone, project_type, location, timeline, description, budget, status, created_at, enquiry_attachments(count)",
      )
      .order("created_at", { ascending: false });
    if (enquiriesError) throw enquiriesError;

    const attachmentCounts = new Map<string, number>();
    for (const enquiry of (enquiries ?? []) as {
      id: string;
      enquiry_attachments: { count: number }[];
    }[]) {
      attachmentCounts.set(enquiry.id, enquiry.enquiry_attachments?.[0]?.count ?? 0);
    }

    return buildEnquiryListItems(enquiries ?? [], attachmentCounts);
  } catch (error) {
    console.error("Could not load enquiries", error);
    return null;
  }
}
