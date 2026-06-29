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

function buildRhBankingPage(params: VendorOutgoingInvoiceParams) {
  if (!hasBankingDetails(params.vendorBanking)) return "";

  const rowsHtml = bankingRows(params.vendorBanking)
    .map(
      ([label, value]) => `
        <tr>
          <td class="rh-bank-label">${escapeHtml(label)}</td>
          <td class="rh-bank-value">${multiline(value)}</td>
        </tr>`
    )
    .join("");

  return `
    <section class="rh-bank-page">
      <div class="rh-bank-header">
        <strong>${escapeHtml(params.vendorName)}</strong>
        <span>WIRE TRANSFER DETAILS</span>
      </div>
      <div class="rh-bank-reference">
        Re: Invoice ${params.invoiceNumber ? escapeHtml(params.invoiceNumber) : "Vendor Invoice"} - ${escapeHtml(params.billToName)}
      </div>
      <table class="rh-bank-table">${rowsHtml}</table>
      <div class="rh-fee-box">
        Bank fees are the sender's responsibility. Please cover any shortfall caused by intermediary bank fees.
      </div>
    </section>`;
}

export function buildRhInvoiceHtml(params: VendorOutgoingInvoiceParams): string {
  const content = `
    <section class="rh-invoice">
      <header class="rh-banner">
        <div>
          <div class="rh-vendor-name">${escapeHtml(params.vendorName)}</div>
          ${params.vendorAddress ? `<div class="rh-vendor-address">${multiline(params.vendorAddress)}</div>` : ""}
        </div>
        <div class="rh-meta">
          <div class="rh-title">INVOICE</div>
          ${params.invoiceNumber ? `<div class="rh-number">${escapeHtml(params.invoiceNumber)}</div>` : ""}
          <div>${escapeHtml(formatDate(params.invoiceDate))}</div>
        </div>
      </header>
      <section class="rh-bill-to">
        <div class="rh-section-label">BILL TO</div>
        <strong>${escapeHtml(params.billToName)}</strong>
        ${params.billToAddress ? `<p>${multiline(params.billToAddress)}</p>` : ""}
      </section>
      <table class="rh-lines">
        <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
        <tbody>${lineRows(params.lines)}</tbody>
      </table>
      ${params.notes ? `<div class="rh-notes"><strong>Notes:</strong><br />${multiline(params.notes)}</div>` : ""}
      <div class="rh-total"><span>TOTAL</span><strong>${formatUsd(params.totalUsd)}</strong></div>
    </section>
    ${buildRhBankingPage(params)}`;

  return buildBaseHtml({
    content,
    styles: `
      .rh-invoice { color:#1E293B; display:flex; flex-direction:column; min-height:8.65in; }
      .rh-banner { align-items:flex-start; background:#0D1B34; color:#fff; display:flex; justify-content:space-between; margin-bottom:24px; padding:20px 32px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .rh-vendor-name { color:#fff; font-size:15pt; font-weight:700; }
      .rh-vendor-address { color:#94A3B8; font-size:8.5pt; line-height:1.5; margin-top:4px; max-width:3.7in; }
      .rh-meta { color:#94A3B8; font-size:8.5pt; text-align:right; }
      .rh-title { color:#F59E0B; font-size:26pt; font-weight:900; letter-spacing:2px; line-height:1; }
      .rh-number { color:#fff; font-size:11pt; font-weight:700; margin-top:8px; }
      .rh-section-label { color:#64748B; font-size:7.5pt; font-weight:700; letter-spacing:2px; margin-bottom:4px; text-transform:uppercase; }
      .rh-bill-to { margin-bottom:24px; }
      .rh-bill-to strong { color:#0D1B34; font-size:10.5pt; }
      .rh-bill-to p { color:#475569; font-size:9pt; line-height:1.6; margin-top:4px; }
      .rh-lines { border-collapse:collapse; width:100%; }
      .rh-lines thead tr { background:#F59E0B; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .rh-lines th { color:#0D1B34; font-size:8.5pt; font-weight:700; padding:9px 10px; text-align:left; text-transform:uppercase; }
      .rh-lines td { border-bottom:1px solid #E2E8F0; padding:9px 10px; vertical-align:top; }
      .rh-lines tbody tr:nth-child(even) td { background:#F8FAFC; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .rh-lines .amount { text-align:right; width:1.6in; }
      .rh-notes { color:#64748B; margin:18px 0 0; }
      .rh-total { align-items:center; background:#0D1B34; color:#fff; display:flex; gap:32px; justify-content:flex-end; margin-top:auto; padding:14px 24px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .rh-total span { color:#94A3B8; font-size:8pt; letter-spacing:4px; }
      .rh-total strong { color:#F59E0B; font-size:16pt; font-weight:900; }
      .rh-bank-page { break-before:page; page-break-before:always; }
      .rh-bank-header { align-items:center; background:#0D1B34; color:#fff; display:flex; justify-content:space-between; margin-bottom:28px; padding:18px 24px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .rh-bank-header strong { font-size:14pt; }
      .rh-bank-header span { color:#F59E0B; font-size:9pt; font-weight:700; letter-spacing:3px; }
      .rh-bank-reference { color:#475569; font-size:9pt; margin-bottom:20px; }
      .rh-bank-table { border-collapse:collapse; width:100%; }
      .rh-bank-label { border-bottom:1px solid #F1F5F9; border-left:3px solid #F59E0B; color:#94A3B8; font-size:8pt; letter-spacing:.5px; padding:10px 14px; text-transform:uppercase; vertical-align:top; width:1.9in; }
      .rh-bank-value { border-bottom:1px solid #F1F5F9; color:#0D1B34; font-size:11pt; font-weight:700; padding:10px 14px; }
      .rh-fee-box { background:#FFF7ED; border-left:3px solid #F59E0B; color:#92400E; font-size:8.5pt; margin-top:20px; padding:12px 16px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    `,
    title: `Invoice ${params.invoiceNumber ?? params.invoiceDate} - ${params.vendorName}`,
  });
}
