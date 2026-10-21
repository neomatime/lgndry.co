"use client";

import { Download } from "lucide-react";
import type { InvoiceListItem } from "@/features/invoices/types";

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function InvoiceExportButton({ rows }: { rows: InvoiceListItem[] }) {
  const download = () => {
    const header = [
      "Invoice ID",
      "Client",
      "Contact",
      "Project",
      "Title",
      "Issued",
      "Due",
      "Billing Type",
      "Status",
      "Total ZAR",
      "Paid ZAR",
      "Outstanding ZAR",
      "Owner",
    ];
    const body = rows.map((row) => [
      row.reference,
      row.clientName,
      row.contactName,
      row.projectName ?? "",
      row.title,
      row.issueDate,
      row.dueDate,
      row.billingType,
      row.displayStatus,
      row.total.toFixed(2),
      row.paidAmount.toFixed(2),
      row.outstanding.toFixed(2),
      row.owner.name,
    ]);
    const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `lgndry-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={!rows.length}
      className="border-line-strong inline-flex h-10 items-center gap-2 border px-4 text-sm font-medium disabled:opacity-40"
    >
      <Download className="size-4" aria-hidden="true" />
      Export
    </button>
  );
}
