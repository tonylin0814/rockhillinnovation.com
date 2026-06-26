import { buildBaseHtml } from "@/lib/templates/base";
import { buildVendorBankingPage, escapeHtml, formatDate, formatUsd, lineRows, multiline } from "@/lib/templates/vendor-invoices/shared";
import type { VendorOutgoingInvoiceParams } from "@/lib/templates/vendor-invoices/types";

export function buildRhInvoiceHtml(params: VendorOutgoingInvoiceParams): string {
  const content = `
    <div class="slate-banner">
      <div>${escapeHtml(params.vendorName)}</div>
      <h1>INVOICE</h1>
    </div>
    <div class="accent"></div>
    <div class="info-row">
      <div>
        <div class="label">Bill To</div>
        <strong>${escapeHtml(params.billToName)}</strong>
        ${params.billToAddress ? `<div class="address">${multiline(params.billToAddress)}</div>` : ""}
      </div>
      <div class="meta-card">
        ${params.invoiceNumber ? `<p><span>Invoice #</span>${escapeHtml(params.invoiceNumber)}</p>` : ""}
        <p><span>Date</span>${escapeHtml(formatDate(params.invoiceDate))}</p>
      </div>
    </div>
    <table class="vendor-lines">
      <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
      <tbody>${lineRows(params.lines)}</tbody>
    </table>
    <div class="total-box"><span>Total</span><strong>${formatUsd(params.totalUsd)}</strong></div>
    ${params.notes ? `<div class="notes"><strong>Notes:</strong><br />${multiline(params.notes)}</div>` : ""}
    <footer>${escapeHtml(params.vendorName)} - Services & Maintenance</footer>
    ${buildVendorBankingPage(params)}
  `;

  return buildBaseHtml({
    content,
    styles: `
      .slate-banner { align-items:center; background:#334155; color:#fff; display:flex; justify-content:space-between; padding:18px 40px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .slate-banner div { font-size:15pt; font-weight:700; }
      .slate-banner h1 { font-size:22pt; font-weight:300; letter-spacing:6px; margin:0; }
      .accent { background:#94a3b8; height:4px; margin-bottom:22px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .info-row { display:grid; grid-template-columns:1fr 2.5in; gap:24px; margin-bottom:22px; }
      .info-row strong { color:#334155; }
      .address { color:#555; font-size:9pt; line-height:1.6; }
      .meta-card { background:#f8fafc; border:1px solid #e2e8f0; padding:12px; }
      .meta-card p { display:flex; justify-content:space-between; margin:2px 0; }
      .meta-card span { color:#64748b; font-size:8pt; font-weight:700; text-transform:uppercase; }
      .vendor-lines { border-collapse:collapse; width:100%; }
      .vendor-lines th { background:#475569; color:#fff; padding:9px 10px; text-align:left; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .vendor-lines td { border-bottom:1px solid #e2e8f0; padding:8px 10px; }
      .vendor-lines tbody tr:nth-child(even) td { background:#f8fafc; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .vendor-lines .amount { text-align:right; width:1.6in; }
      .total-box { background:#f1f5f9; color:#334155; display:flex; font-weight:700; justify-content:space-between; margin:18px 0 28px auto; padding:10px 14px; width:2.8in; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .notes { color:#555; margin:18px 0; }
      footer { color:#94a3b8; font-size:8.5pt; margin-top:30px; text-align:center; }
    `,
    title: `Invoice ${params.invoiceNumber ?? params.invoiceDate}`,
  });
}
