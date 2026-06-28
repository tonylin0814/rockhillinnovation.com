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
        banking.institutionNo ||
        banking.transitNo ||
        banking.bankTel ||
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
    ["Institution No.", banking.institutionNo],
    ["Transit / Branch No.", banking.transitNo],
    ["Bank TEL", banking.bankTel],
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

export function buildVendorBankingPage({
  billToName,
  invoiceNumber,
  showPaymentNotice = true,
  vendorAddress,
  vendorBanking,
  vendorName,
}: {
  billToName: string;
  invoiceNumber: string | null;
  showPaymentNotice?: boolean;
  vendorAddress: string | null;
  vendorBanking: VendorBanking | null;
  vendorName: string;
}) {
  if (!hasBankingDetails(vendorBanking)) {
    return "";
  }

  const rowsHtml = bankingRows(vendorBanking)
    .map(
      ([label, value]) => `
      <tr>
        <td style="border:none;border-top:1px solid #eee;padding:11px 14px;font-size:9pt;color:#5a6270;white-space:nowrap;vertical-align:top;width:1.8in;">${escapeHtml(label)}</td>
        <td style="border:none;border-top:1px solid #eee;padding:11px 14px;font-size:10pt;color:#0d1b34;font-weight:600;">${multiline(value)}</td>
      </tr>`
    )
    .join("");
  const currencyLabel = vendorBanking?.currency ? `${vendorBanking.currency} Wire Transfer` : "Wire Transfer";

  return `
    <div class="page-break"></div>

    <div class="doc-header">
      <div>
        <div style="color:#0d1b34;font-size:16pt;font-weight:800;margin-bottom:6px;">${escapeHtml(vendorName)}</div>
        ${vendorAddress ? `<div class="doc-address-line">${multiline(vendorAddress)}</div>` : ""}
      </div>
      <div class="doc-type-badge" style="font-size:12pt;padding:10px 18px;white-space:nowrap;">BANKING INFO</div>
    </div>

    <div style="margin-bottom:22px;">
      <div style="font-size:8pt;color:#5a6270;margin-bottom:2px;">Re: Vendor Invoice</div>
      <div style="color:#0d1b34;font-weight:700;font-size:12pt;">
        ${invoiceNumber ? escapeHtml(invoiceNumber) : "Vendor Invoice"}
        <span style="font-weight:400;font-size:9pt;color:#5a6270;">- ${escapeHtml(billToName)}</span>
      </div>
      ${
        showPaymentNotice
          ? `<div style="margin-top:12px;background:#f5f6f8;border-left:3px solid #0d1b34;padding:10px 16px;font-size:9pt;color:#444;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        Use the vendor banking information below for payment.
        <strong style="color:#0d1b34;">Always include the invoice number as the wire reference</strong>
        so the payment can be matched immediately.
      </div>`
          : ""
      }
    </div>

    <div style="border:1px solid #e4e6ea;border-radius:4px;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="background:#0d1b34;color:#fff;padding:12px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <span style="font-size:9pt;font-weight:600;letter-spacing:0.06em;opacity:0.7;">${escapeHtml(vendorBanking?.currency ?? "")}</span>
        &nbsp;&nbsp;
        <span style="font-size:11pt;font-weight:700;">${escapeHtml(currencyLabel)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:0;">${rowsHtml}</table>
    </div>

    <div style="margin-top:20px;background:#fff8e7;border:1px solid #f0d070;border-left:3px solid #d4a000;padding:10px 14px;font-size:8.5pt;color:#5a4200;border-radius:0 4px 4px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <strong>Important:</strong>
      Bank fees are the sender's responsibility. If a bank deducts a fee that results in a shortfall,
      please arrange an additional transfer to cover the difference.
    </div>`;
}
