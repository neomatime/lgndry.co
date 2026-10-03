import { Tabs } from "@/components/ui/tabs";
import type { EnquiryDetail } from "@/features/enquiries/detail-view-model";
import { RelatedFollowUps } from "@/features/follow-ups/components/related-follow-ups";
import { relatedAddAvailability } from "@/features/follow-ups/related-view-model";

function formatBytes(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1000)} KB`;
}

export function EnquiryDetailTabs({ enquiry }: { enquiry: EnquiryDetail }) {
  const followUpAdd = relatedAddAvailability("enquiry", {
    archived: enquiry.archived,
    clientId: enquiry.clientId,
    clientArchived: enquiry.clientArchived,
  });
  return (
    <Tabs
      items={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="font-medium">Enquiry Overview</h3>
                <p className="text-ink-muted mt-2 text-sm whitespace-pre-line">
                  {enquiry.description}
                </p>
              </div>
              <div>
                <h3 className="font-medium">Services Requested</h3>
                <span className="bg-line mt-2 inline-flex items-center px-2.5 py-1 text-xs font-medium">
                  {enquiry.projectType}
                </span>
              </div>
            </div>
          ),
        },
        {
          id: "attachments",
          label: `Attachments (${enquiry.attachments.length})`,
          content:
            enquiry.attachments.length === 0 ? (
              <p className="text-ink-muted text-sm">No attachments.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {enquiry.attachments.map((attachment) => (
                  <li
                    key={attachment.fileName}
                    className="border-line flex items-center justify-between border p-3 text-sm"
                  >
                    {attachment.url ? (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {attachment.fileName}
                      </a>
                    ) : (
                      <span>{attachment.fileName}</span>
                    )}
                    <span className="text-ink-muted">{formatBytes(attachment.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            ),
        },
        {
          id: "follow-ups",
          label: `Follow-ups (${enquiry.followUps.total})`,
          content: (
            <RelatedFollowUps
              related={enquiry.followUps}
              subject="enquiry"
              add={{ clientId: enquiry.clientId ?? "", enquiryId: enquiry.id }}
              canAdd={followUpAdd.canAdd}
              addBlockedReason={followUpAdd.canAdd ? undefined : followUpAdd.reason}
            />
          ),
        },
        {
          id: "activity",
          label: `Activity (${enquiry.activity.length})`,
          content:
            enquiry.activity.length === 0 ? (
              <p className="text-ink-muted text-sm">No activity recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {enquiry.activity.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p>{entry.message}</p>
                    <p className="text-ink-muted text-xs">{entry.relativeTime}</p>
                  </li>
                ))}
              </ul>
            ),
        },
      ]}
    />
  );
}
