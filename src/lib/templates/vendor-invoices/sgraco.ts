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

function buildSgracoBankingPage(params: VendorOutgoingInvoiceParams) {
  if (!hasBankingDetails(params.vendorBanking)) return "";

  const rowsHtml = bankingRows(params.vendorBanking)
    .map(
      ([label, value]) => `
        <tr>
          <td class="sgraco-bank-label">${escapeHtml(label)}</td>
          <td class="sgraco-bank-value">${multiline(value)}</td>
        </tr>`
    )
    .join("");

  return `
    <div class="page-break"></div>
    <section class="sgraco-bank-page">
      <div class="sgraco-bank-header">
        <div><strong>SGRACO</strong><span> CONSULTING INC.</span></div>
        <div>BANKING INFO</div>
      </div>
      <div class="sgraco-bank-reference">Re: Invoice ${params.invoiceNumber ? escapeHtml(params.invoiceNumber) : "Vendor Invoice"}</div>
      <table class="sgraco-bank-table">${rowsHtml}</table>
      <div class="sgraco-fee-box">
        <strong>Important:</strong> Bank fees are the sender's responsibility. If a bank deducts a fee that results in a shortfall, please arrange an additional transfer to cover the difference.
      </div>
    </section>`;
}

export function buildSgracoInvoiceHtml(params: VendorOutgoingInvoiceParams): string {
  const content = `
    <section class="sgraco-invoice">
      <div class="sgraco-top-row">
        <div class="sgraco-brand-block">
          <div class="sgraco-name">SGRACO</div>
          <div class="sgraco-sub">CONSULTING INC.</div>
          ${params.vendorAddress ? `<div class="sgraco-address">${multiline(params.vendorAddress)}</div>` : ""}
        </div>
        <div class="sgraco-meta">
          <div class="sgraco-meta-label">INVOICE</div>
          ${params.invoiceNumber ? `<div class="sgraco-invoice-number">${escapeHtml(params.invoiceNumber)}</div>` : ""}
          <div class="sgraco-date">${escapeHtml(formatDate(params.invoiceDate))}</div>
        </div>
      </div>
      <div class="sgraco-rule-strong"></div>
      <div class="sgraco-rule-thin"></div>
      <section class="sgraco-bill-to">
        <div class="sgraco-section-label">BILL TO</div>
        <strong>${escapeHtml(params.billToName)}</strong>
        ${params.billToAddress ? `<p>${multiline(params.billToAddress)}</p>` : ""}
      </section>
      <table class="sgraco-lines">
        <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
        <tbody>${lineRows(params.lines)}</tbody>
      </table>
      <div class="sgraco-total"><span>TOTAL</span><strong>${formatUsd(params.totalUsd)}</strong></div>
      ${params.notes ? `<div class="sgraco-notes"><strong>Notes:</strong><br />${multiline(params.notes)}</div>` : ""}
    </section>
    ${buildSgracoBankingPage(params)}
  `;

  return buildBaseHtml({
    content,
    styles: `
      .sgraco-invoice { color:#0F172A; }
      .sgraco-top-row { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }
      .sgraco-brand-block { background:#0D9488; color:#fff; padding:14px 20px; min-width:3.3in; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .sgraco-name { color:#fff; font-size:22pt; font-weight:900; letter-spacing:-0.5px; line-height:1; }
      .sgraco-sub { color:#fff; font-size:7pt; font-weight:700; letter-spacing:5px; margin-top:4px; opacity:0.85; }
      .sgraco-address { color:#fff; font-size:8.5pt; line-height:1.5; margin-top:10px; opacity:0.7; }
      .sgraco-meta { min-width:2.2in; text-align:right; }
      .sgraco-meta-label { color:#0D9488; font-size:8pt; font-weight:700; letter-spacing:4px; }
      .sgraco-invoice-number { color:#0F172A; font-size:18pt; font-weight:800; margin-top:5px; }
      .sgraco-date { color:#64748B; font-size:9pt; margin-top:4px; }
      .sgraco-rule-strong { border-top:3px solid #0D9488; margin-top:16px; margin-bottom:2px; }
      .sgraco-rule-thin { border-top:1px solid #0D9488; margin-bottom:20px; }
      .sgraco-section-label { color:#0D9488; font-size:7.5pt; font-weight:700; letter-spacing:3px; margin-bottom:4px; text-transform:uppercase; }
      .sgraco-bill-to { margin-bottom:22px; }
      .sgraco-bill-to strong { color:#0F172A; font-size:10.5pt; }
      .sgraco-bill-to p { color:#64748B; font-size:9pt; line-height:1.6; margin-top:4px; }
      .sgraco-lines { border-collapse:collapse; width:100%; }
      .sgraco-lines th { border-bottom:2px solid #0D9488; color:#0D9488; font-size:8.5pt; font-weight:700; letter-spacing:.5px; padding:8px 10px; text-align:left; text-transform:uppercase; }
      .sgraco-lines td { border-bottom:1px solid #E2E8F0; padding:9px 10px; vertical-align:top; }
      .sgraco-lines tbody tr:nth-child(even) td { background:#F0FDFA; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .sgraco-lines tbody tr:last-child td { border-bottom:2px solid #0D9488; }
      .sgraco-lines .amount { text-align:right; width:1.6in; }
      .sgraco-total { align-items:center; background:#0D9488; color:#fff; display:flex; justify-content:space-between; margin:20px 0 28px auto; padding:12px 18px; width:2.8in; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .sgraco-total span { font-size:8pt; font-weight:700; letter-spacing:3px; }
      .sgraco-total strong { font-size:14pt; font-weight:800; }
      .sgraco-notes { color:#64748B; margin:18px 0; }
      .sgraco-bank-header { align-items:center; background:#0D9488; color:#fff; display:flex; justify-content:space-between; margin-bottom:24px; padding:14px 20px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .sgraco-bank-header strong { font-size:16pt; letter-spacing:-0.5px; }
      .sgraco-bank-header span { font-size:8pt; letter-spacing:3px; opacity:0.85; }
      .sgraco-bank-header div:last-child { font-size:9pt; font-weight:700; letter-spacing:4px; }
      .sgraco-bank-reference { color:#64748B; font-size:9pt; margin-bottom:20px; }
      .sgraco-bank-table { border-collapse:collapse; width:100%; }
      .sgraco-bank-label { border-bottom:1px solid #E2E8F0; color:#64748B; font-size:8.5pt; padding:10px 0; vertical-align:top; width:1.8in; }
      .sgraco-bank-value { border-bottom:1px solid #E2E8F0; color:#0F172A; font-size:10pt; font-weight:600; padding:10px 0; }
      .sgraco-fee-box { background:#F0FDFA; border-left:3px solid #0D9488; color:#134E4A; font-size:8.5pt; margin-top:24px; padding:10px 16px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    `,
    title: `Invoice ${params.invoiceNumber ?? params.invoiceDate}`,
  });
}
