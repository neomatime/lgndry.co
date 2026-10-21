import type {
  CommercialLineItem,
  InvoiceDisplayStatus,
  InvoiceListItem,
  InvoiceStatus,
  QuoteListItem,
} from "@/features/invoices/types";

export function money(value: number | string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export function reference(prefix: "QT" | "INV", number: number, createdAt: string) {
  return `${prefix}-${new Date(createdAt).getFullYear()}-${String(number).padStart(4, "0")}`;
}

export function calculateTotals(
  items: Pick<CommercialLineItem, "quantity" | "unitAmount">[],
  discountAmount = 0,
) {
  const subtotal =
    Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0) * 100) / 100;
  const discount = Math.max(0, Math.min(discountAmount, subtotal));
  return { subtotal, discountAmount: discount, total: subtotal - discount };
}

export function invoiceDisplayStatus(
  status: InvoiceStatus,
  paid: number,
  total: number,
  dueDate: string,
  today: string,
): InvoiceDisplayStatus {
  if (status === "Void" || status === "Draft" || status === "Paid") return status;
  if (paid > 0 && paid < total) return "Partially Paid";
  if (dueDate && dueDate < today) return "Overdue";
  return "Open";
}

export type InvoiceFilter = "All" | "Open" | "Overdue" | "Paid" | "Draft" | "Void";
export type InvoiceSort = "due-date" | "newest" | "oldest" | "amount-high";

export function filterInvoices(rows: InvoiceListItem[], view: InvoiceFilter, search: string) {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (view !== "All" && row.displayStatus !== view && row.status !== view) return false;
    if (!query) return true;
    return [row.reference, row.clientName, row.contactName, row.projectName ?? "", row.title]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function sortInvoices(rows: InvoiceListItem[], sort: InvoiceSort) {
  return [...rows].sort((a, b) => {
    if (sort === "due-date") return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    if (sort === "amount-high") return b.total - a.total;
    const delta = a.createdAt.localeCompare(b.createdAt);
    return sort === "newest" ? -delta : delta;
  });
}

export function summarizeInvoices(rows: InvoiceListItem[], today: string) {
  const month = today.slice(0, 7);
  const weekEnd = new Date(`${today}T12:00:00+02:00`);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  return {
    outstanding: rows.reduce((sum, row) => sum + row.outstanding, 0),
    sent: rows.filter((row) => row.status === "Sent").length,
    paidThisMonth: rows.filter((row) => row.status === "Paid" && row.paidAt.startsWith(month))
      .length,
    dueThisWeek: rows.filter(
      (row) => row.outstanding > 0 && row.dueDate >= today && row.dueDate <= weekEndIso,
    ).length,
  };
}

export function filterQuotes(rows: QuoteListItem[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) =>
    [row.reference, row.clientName, row.contactName, row.title, row.status]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}
