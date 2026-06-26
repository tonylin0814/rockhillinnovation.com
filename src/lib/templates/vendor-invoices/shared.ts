import type { VendorBanking, VendorOutgoingInvoiceLine } from "@/lib/templates/vendor-invoices/types";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function multiline(value: string | null) {
  return escapeHtml(value ?? "").replace(/\n/g, "<br />");
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

export function hasBankingDetails(banking: VendorBanking | null) {
  return Boolean(
    banking &&
      (banking.accountName ||
        banking.accountNumber ||
        banking.bankName ||
        banking.bankAddress ||
        banking.swiftCode ||
        banking.abaRouting ||
        banking.currency ||
        banking.bankingInstructions)
  );
}

export function bankingRows(banking: VendorBanking | null) {
  if (!banking) return [];

  return [
    ["Account Name", banking.accountName],
    ["Account Number", banking.accountNumber],
    ["Bank Name", banking.bankName],
    ["Bank Address", banking.bankAddress],
    ["SWIFT / BIC", banking.swiftCode],
    ["ABA Routing", banking.abaRouting],
    ["Currency", banking.currency],
    ["Special Instructions", banking.bankingInstructions],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

export function lineRows(lines: VendorOutgoingInvoiceLine[]) {
  return lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.description)}</td>
        <td class="amount">${formatUsd(line.amountUsd)}</td>
      </tr>`
    )
    .join("");
}
