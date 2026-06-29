import { buildBaseHtml } from "@/lib/templates/base";
import {
  bankingRows,
  escapeHtml,
  formatDate,
  formatUsd,
  hasBankingDetails,
  lineRows,
  multiline,
} from "@/lib/templates/vendor-invoices/shared";
import type { VendorOutgoingInvoiceParams } from "@/lib/templates/vendor-invoices/types";

function buildLmBankingPage(params: VendorOutgoingInvoiceParams) {
  if (!hasBankingDetails(params.vendorBanking)) return "";

  const rowsHtml = bankingRows(params.vendorBanking)
    .map(
      ([label, value]) => `
        <tr>
          <td class="lm-bank-label">${escapeHtml(label)}</td>
          <td class="lm-bank-value">${multiline(value)}</td>
        </tr>`
    )
    .join("");

  return `
    <section class="lm-bank-page">
      <div class="lm-bank-heading">
        <strong>${escapeHtml(params.vendorName)}</strong>
        <span>BANKING INFORMATION</span>
      </div>
      <div class="lm-bank-rule"></div>
      <div class="lm-bank-reference">Re: Invoice ${params.invoiceNumber ? escapeHtml(params.invoiceNumber) : "Vendor Invoice"}</div>
      <table class="lm-bank-table">${rowsHtml}</table>
      <div class="lm-fee-note">
        Bank fees are the sender's responsibility. Please include the invoice number as the wire reference.
      </div>
    </section>`;
}

export function buildLmInvoiceHtml(params: VendorOutgoingInvoiceParams): string {
  const content = `
    <section class="lm-invoice">
      <div class="lm-top-row">
        <div class="lm-brand">
          <div class="lm-initials">LM</div>
          <div class="lm-vendor-name">${escapeHtml(params.vendorName)}</div>
          ${params.vendorAddress ? `<div class="lm-vendor-address">${multiline(params.vendorAddress)}</div>` : ""}
        </div>
        <div class="lm-meta">
          <div class="lm-title">INVOICE</div>
          ${params.invoiceNumber ? `<div class="lm-number">${escapeHtml(params.invoiceNumber)}</div>` : ""}
          <div class="lm-date">${escapeHtml(formatDate(params.invoiceDate))}</div>
        </div>
      </div>
      <div class="lm-rule"></div>
      <section class="lm-bill-to">
        <div class="lm-section-label">BILL TO</div>
        <strong>${escapeHtml(params.billToName)}</strong>
        ${params.billToAddress ? `<p>${multiline(params.billToAddress)}</p>` : ""}
      </section>
      <table class="lm-lines">
        <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
        <tbody>${lineRows(params.lines)}</tbody>
      </table>
      <div class="lm-total">
        <div class="lm-total-rule-dark"></div>
        <div class="lm-total-rule-light"></div>
        <div class="lm-total-row"><span>TOTAL</span><strong>${formatUsd(params.totalUsd)}</strong></div>
      </div>
      ${params.notes ? `<div class="lm-notes"><strong>Notes:</strong><br />${multiline(params.notes)}</div>` : ""}
    </section>
    ${buildLmBankingPage(params)}`;

  return buildBaseHtml({
    content,
    styles: `
      .lm-invoice { color:#1A1A1A; min-height:8.65in; }
      .lm-top-row { display:flex; gap:24px; justify-content:space-between; }
      .lm-initials { color:#7B2D42; display:block; font-size:52pt; font-weight:900; letter-spacing:-3px; line-height:1; margin-bottom:-8px; }
      .lm-vendor-name { color:#1A1A1A; font-size:10pt; font-weight:600; }
      .lm-vendor-address { color:#6B7280; font-size:9pt; line-height:1.6; margin-top:4px; max-width:3.4in; }
      .lm-meta { text-align:right; }
      .lm-title { color:#7B2D42; font-size:9pt; font-weight:700; letter-spacing:4px; text-transform:uppercase; }
      .lm-number { color:#1A1A1A; font-size:18pt; font-weight:800; margin-top:5px; }
      .lm-date { color:#6B7280; font-size:9pt; margin-top:4px; }
      .lm-rule { border-top:1.5px solid #7B2D42; margin:18px 0 20px; }
      .lm-section-label { color:#7B2D42; font-size:7.5pt; font-weight:700; letter-spacing:3px; margin-bottom:4px; text-transform:uppercase; }
      .lm-bill-to { margin-bottom:22px; }
      .lm-bill-to strong { color:#1A1A1A; font-size:10.5pt; font-weight:600; }
      .lm-bill-to p { color:#6B7280; font-size:9pt; line-height:1.6; margin-top:4px; }
      .lm-lines { border-collapse:collapse; width:100%; }
      .lm-lines th { border-bottom:1.5px solid #7B2D42; color:#7B2D42; font-size:8.5pt; font-weight:700; letter-spacing:.5px; padding:8px 0; text-align:left; text-transform:uppercase; }
      .lm-lines td { border-bottom:1px solid #E5E7EB; color:#1A1A1A; font-size:9.5pt; padding:9px 0; vertical-align:top; }
      .lm-lines .amount { text-align:right; width:1.6in; }
      .lm-total { align-items:flex-end; display:flex; flex-direction:column; margin:20px 0 28px auto; width:2.6in; }
      .lm-total-rule-dark { border-top:1.5px solid #1A1A1A; margin-bottom:4px; width:100%; }
      .lm-total-rule-light { border-top:1px solid #E5E7EB; margin-bottom:8px; width:100%; }
      .lm-total-row { color:#1A1A1A; display:flex; font-size:12pt; font-weight:700; gap:32px; justify-content:space-between; width:100%; }
      .lm-total-row strong { color:#7B2D42; }
      .lm-notes { color:#6B7280; margin:18px 0; }
      .lm-bank-page { break-before:page; page-break-before:always; }
      .lm-bank-heading { align-items:flex-start; display:flex; justify-content:space-between; }
      .lm-bank-heading strong { color:#1A1A1A; font-size:13pt; font-weight:700; }
      .lm-bank-heading span { color:#7B2D42; font-size:8pt; font-weight:700; letter-spacing:4px; text-transform:uppercase; }
      .lm-bank-rule { border-top:1.5px solid #7B2D42; margin:12px 0 24px; }
      .lm-bank-reference { color:#6B7280; font-size:9pt; margin-bottom:20px; }
      .lm-bank-table { border-collapse:collapse; width:100%; }
      .lm-bank-label { border-bottom:1px solid #E5E7EB; color:#6B7280; font-size:8.5pt; padding:9px 0; vertical-align:top; width:1.8in; }
      .lm-bank-value { border-bottom:1px solid #E5E7EB; color:#1A1A1A; font-size:10pt; font-weight:600; padding:9px 0; }
      .lm-fee-note { border-left:2px solid #7B2D42; color:#6B7280; font-size:8.5pt; margin-top:24px; padding:10px 16px; }
    `,
    title: `Invoice ${params.invoiceNumber ?? params.invoiceDate} - ${params.vendorName}`,
  });
}
