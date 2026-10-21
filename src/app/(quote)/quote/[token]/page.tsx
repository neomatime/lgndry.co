import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicQuote } from "@/features/invoices/components/public-quote";
import { fetchPublicQuote } from "@/features/invoices/fetch-public-quote";

export const metadata: Metadata = {
  title: "Review Quote · LGNDRY.Co",
  robots: { index: false, follow: false },
};

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await fetchPublicQuote(token);
  if (!quote) notFound();
  return <PublicQuote quote={quote} token={token} />;
}
