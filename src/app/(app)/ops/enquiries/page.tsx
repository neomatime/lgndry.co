import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buildEnquiryRows } from "@/features/start-a-project/admin/build-enquiry-rows";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Enquiries" };

const BUCKET = "enquiry-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 5;

/**
 * Bare proof that the pipeline works end to end: every Start a Project
 * submission, newest first, with a link to open each attachment. No
 * search, filters, tabs or styling — the full Enquiries page (matching
 * docs/design-references/enquiries.png / view-enquiry.png) is a later
 * sub-project.
 */
export default async function EnquiriesPage() {
  await requireOpsUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: enquiries }, { data: attachments }] = await Promise.all([
    supabase
      .from("enquiries")
      .select("id, full_name, company, email, project_type, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("enquiry_attachments").select("enquiry_id, file_name, storage_path"),
  ]);

  const attachmentsByEnquiry = new Map<string, { file_name: string; storage_path: string }[]>();
  for (const attachment of attachments ?? []) {
    const list = attachmentsByEnquiry.get(attachment.enquiry_id) ?? [];
    list.push(attachment);
    attachmentsByEnquiry.set(attachment.enquiry_id, list);
  }

  const signedUrlByPath = new Map<string, string | null>();
  for (const attachment of attachments ?? []) {
    if (signedUrlByPath.has(attachment.storage_path)) continue;
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS);
    signedUrlByPath.set(attachment.storage_path, data?.signedUrl ?? null);
  }

  const rows = buildEnquiryRows(enquiries ?? [], attachmentsByEnquiry, signedUrlByPath);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Enquiries"
        description="Every submission from the Start a Project form, newest first."
      />
      {rows.length === 0 ? (
        <EmptyState title="No enquiries yet">
          Submissions from /start-a-project will appear here.
        </EmptyState>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-line border-b text-left">
              <th className="py-2 pr-4">Name / Company</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Project type</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Submitted</th>
              <th className="py-2 pr-4">Attachments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-line border-b align-top">
                <td className="py-2 pr-4">
                  {row.fullName}
                  {row.company ? <div className="text-ink-muted">{row.company}</div> : null}
                </td>
                <td className="py-2 pr-4">{row.email}</td>
                <td className="py-2 pr-4">{row.projectType}</td>
                <td className="py-2 pr-4">{row.status}</td>
                <td className="py-2 pr-4">{new Date(row.submittedAt).toLocaleString("en-ZA")}</td>
                <td className="py-2 pr-4">
                  {row.attachments.length === 0 ? (
                    "—"
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {row.attachments.map((attachment, index) => (
                        <li key={index}>
                          {attachment.url ? (
                            <a
                              className="underline"
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {attachment.fileName}
                            </a>
                          ) : (
                            attachment.fileName
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
