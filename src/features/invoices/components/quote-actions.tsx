"use client";

import { FilePenLine, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviseQuote, sendQuote } from "@/features/invoices/actions";
import type { QuoteDetail } from "@/features/invoices/types";
import { Button } from "@/components/ui/button";

export function QuoteActions({ quote }: { quote: QuoteDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  if (!["Draft", "Sent", "Expired"].includes(quote.status)) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2 text-right">
      {quote.status === "Draft" || quote.status === "Sent" ? (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await sendQuote(quote.id, quote.version);
              if (result.status === "success") router.refresh();
              else setMessage(result.message);
            })
          }
        >
          <Send className="size-4" aria-hidden="true" />
          {pending ? "Sending..." : quote.status === "Draft" ? "Send Quote" : "Resend Quote"}
        </Button>
      ) : null}
      {quote.status === "Sent" || quote.status === "Expired" ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await reviseQuote(quote.id, quote.version);
              if (result.status === "success")
                router.push(`/ops/invoices/quotes/${result.id}/edit`);
              else setMessage(result.message);
            })
          }
        >
          <FilePenLine className="size-4" aria-hidden="true" />
          {pending ? "Creating..." : "Create Revision"}
        </Button>
      ) : null}
      {message ? (
        <p role="alert" className="basis-full text-sm font-medium">
          {message}
        </p>
      ) : null}
    </div>
  );
}
