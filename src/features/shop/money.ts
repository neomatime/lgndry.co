const NBSP = " ";

/**
 * "R 75 000" — the rand format the shop has always shown. Written out rather
 * than left to Intl so the server and every browser render byte-identical text
 * (the legacy `toLocaleString("en-ZA")`: non-breaking-space thousands, decimal
 * comma, at most three decimals).
 */
export function formatMoney(value: unknown): string {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "R 0";
  const [whole = "0", fraction = ""] = Math.abs(amount).toFixed(3).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const decimals = fraction.replace(/0+$/, "");
  const sign = amount < 0 && (Number(whole) > 0 || decimals) ? "-" : "";
  return `R ${sign}${grouped}${decimals ? `,${decimals}` : ""}`;
}
