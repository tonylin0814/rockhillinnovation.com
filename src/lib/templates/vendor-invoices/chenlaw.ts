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

function ornamentalDivider(className: string) {
  return `<div class="${className}"><span></span><b>&#9670;</b><span></span></div>`;
}

function buildChenlawBankingPage(params: VendorOutgoingInvoiceParams) {
  if (!hasBankingDetails(params.vendorBanking)) return "";

  const rowsHtml = bankingRows(params.vendorBanking)
    .map(
      ([label, value]) => `
        <tr>
          <td class="chenlaw-bank-label">${escapeHtml(label)}</td>
          <td class="chenlaw-bank-value">${multiline(value)}</td>
        </tr>`
    )
    .join("");

  return `
    <section class="chenlaw-shell chenlaw-bank-page">
      <div class="chenlaw-bank-heading">
        <div class="chenlaw-bank-vendor">${escapeHtml(params.vendorName)}</div>
        ${ornamentalDivider("chenlaw-ornament")}
        <div class="chenlaw-bank-title">Wire Transfer Instructions</div>
        <div class="chenlaw-bank-reference">
          Re: Invoice ${params.invoiceNumber ? escapeHtml(params.invoiceNumber) : "Vendor Invoice"} - ${escapeHtml(params.billToName)}
        </div>
      </div>
      <table class="chenlaw-bank-table">
        <thead><tr><th colspan="2">Banking Details</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="chenlaw-fee-box">
        <strong>Important:</strong> Bank fees are the sender's responsibility. If a bank deducts a fee that results in a shortfall, please arrange an additional transfer to cover the difference.
      </div>
      <footer class="chenlaw-bank-footer">Strictly Confidential - This document is for the addressee only.</footer>
    </section>`;
}

export function buildChenlawInvoiceHtml(params: VendorOutgoingInvoiceParams): string {
  const content = `
    <section class="chenlaw-shell">
      <header class="chenlaw-header">
        <div class="chenlaw-vendor-name">${escapeHtml(params.vendorName)}</div>
        ${ornamentalDivider("chenlaw-ornament")}
        <div class="chenlaw-subtitle">Legal &amp; Professional Services</div>
        ${params.vendorAddress ? `<div class="chenlaw-vendor-address">${multiline(params.vendorAddress)}</div>` : ""}
      </header>
      <section class="chenlaw-info-grid">
        <div>
          <div class="chenlaw-label">BILL TO</div>
          <div class="chenlaw-bill-name">${escapeHtml(params.billToName)}</div>
          ${params.billToAddress ? `<div class="chenlaw-address">${multiline(params.billToAddress)}</div>` : ""}
        </div>
        <div class="chenlaw-meta">
          ${params.invoiceNumber ? `<div><span>Invoice No.</span><strong>${escapeHtml(params.invoiceNumber)}</strong></div>` : ""}
          <div><span>Date</span><strong>${escapeHtml(formatDate(params.invoiceDate))}</strong></div>
          <div><span>Type</span><strong>Invoice</strong></div>
        </div>
      </section>
      <table class="chenlaw-lines">
        <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
        <tbody>${lineRows(params.lines)}</tbody>
      </table>
      <div class="chenlaw-total"><span>TOTAL DUE</span><strong>${formatUsd(params.totalUsd)}</strong></div>
      ${params.notes ? `<div class="chenlaw-notes"><strong>Notes:</strong><br />${multiline(params.notes)}</div>` : ""}
      <footer class="chenlaw-footer">Confidential - Prepared for Rock Hill Innovation</footer>
    </section>
    ${buildChenlawBankingPage(params)}
  `;

  return buildBaseHtml({
    content,
    styles: `
      body { background:#FFFEF5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .chenlaw-shell { background:#FFFEF5; color:#2C2C2C; min-height:8.85in; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .chenlaw-header { padding:28px 0 18px; text-align:center; }
      .chenlaw-vendor-name { color:#1A2744; font-size:20pt; font-weight:700; letter-spacing:1px; }
      .chenlaw-ornament { align-items:center; display:flex; gap:10px; justify-content:center; margin:10px auto 8px; max-width:3.2in; }
      .chenlaw-ornament span { border-top:1px solid #C9A84C; flex:1; }
      .chenlaw-ornament b { color:#C9A84C; font-size:9pt; line-height:1; }
      .chenlaw-subtitle { color:#6B7280; font-size:9pt; letter-spacing:1px; }
      .chenlaw-vendor-address { color:#6B7280; font-size:8.5pt; line-height:1.6; margin-top:6px; }
      .chenlaw-info-grid { border-bottom:1.5px solid #C9A84C; border-top:1.5px solid #C9A84C; display:grid; gap:24px; grid-template-columns:1fr 1fr; margin:18px 0; padding:18px 0; }
      .chenlaw-label { color:#C9A84C; font-size:7.5pt; font-weight:700; letter-spacing:3px; margin-bottom:6px; text-transform:uppercase; }
      .chenlaw-bill-name { color:#1A2744; font-size:10.5pt; font-weight:700; }
      .chenlaw-address { color:#6B7280; font-size:9pt; line-height:1.6; margin-top:4px; }
      .chenlaw-meta div { border-bottom:1px solid #E8E4D0; display:flex; justify-content:space-between; padding:5px 0; }
      .chenlaw-meta span { color:#6B7280; font-size:8pt; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
      .chenlaw-meta strong { color:#1A2744; font-size:9pt; font-weight:600; }
      .chenlaw-lines { border-collapse:collapse; width:100%; }
      .chenlaw-lines thead tr { background:#1A2744; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .chenlaw-lines th { color:#C9A84C; font-size:8.5pt; font-weight:700; letter-spacing:.5px; padding:10px 12px; text-align:left; text-transform:uppercase; }
      .chenlaw-lines td { border-bottom:1px solid #E8E4D0; color:#2C2C2C; padding:9px 12px; vertical-align:top; }
      .chenlaw-lines tbody tr:nth-child(even) td { background:#FFF9E8; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .chenlaw-lines .amount { text-align:right; width:1.6in; }
      .chenlaw-total { background:#1A2744; border-bottom:2px solid #1A2744; border-top:2px solid #1A2744; display:flex; justify-content:space-between; margin:0; padding:12px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .chenlaw-total span { color:#C9A84C; font-size:9pt; font-weight:700; letter-spacing:3px; }
      .chenlaw-total strong { color:#fff; font-size:14pt; font-weight:700; }
      .chenlaw-notes { color:#6B7280; margin:18px 0; }
      .chenlaw-footer { border-top:1px solid #E8E4D0; color:#9CA3AF; font-size:8pt; margin-top:24px; padding-top:12px; text-align:center; }
      .chenlaw-bank-heading { text-align:center; }
      .chenlaw-bank-page { break-before:page; page-break-before:always; }
      .chenlaw-bank-vendor { color:#1A2744; font-size:16pt; font-weight:700; text-align:center; }
      .chenlaw-bank-title { color:#1A2744; font-size:10pt; letter-spacing:2px; margin-bottom:4px; text-align:center; }
      .chenlaw-bank-reference { color:#6B7280; font-size:8.5pt; margin-bottom:28px; text-align:center; }
      .chenlaw-bank-table { border:1px solid #C9A84C; border-collapse:collapse; width:100%; }
      .chenlaw-bank-table th { background:#1A2744; color:#C9A84C; font-size:9pt; font-weight:700; letter-spacing:2px; padding:10px; text-align:center; text-transform:uppercase; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .chenlaw-bank-label { background:#FFF9E8; border:1px solid #E8E4D0; color:#6B7280; font-size:8.5pt; padding:10px 14px; vertical-align:top; width:1.8in; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .chenlaw-bank-value { border:1px solid #E8E4D0; color:#1A2744; font-size:10pt; font-weight:700; padding:10px 14px; }
      .chenlaw-fee-box { background:#FFF9E8; border:1px solid #C9A84C; border-left:3px solid #C9A84C; color:#78350F; font-size:8.5pt; margin-top:24px; padding:12px 16px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .chenlaw-bank-footer { color:#9CA3AF; font-size:8pt; margin-top:28px; text-align:center; }
    `,
    title: `Invoice ${params.invoiceNumber ?? params.invoiceDate}`,
  });
}
