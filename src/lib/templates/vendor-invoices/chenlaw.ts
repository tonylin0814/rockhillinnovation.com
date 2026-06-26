import { buildBaseHtml } from "@/lib/templates/base";
import { buildVendorBankingPage, escapeHtml, formatDate, formatUsd, lineRows, multiline } from "@/lib/templates/vendor-invoices/shared";
import type { VendorOutgoingInvoiceParams } from "@/lib/templates/vendor-invoices/types";

export function buildChenlawInvoiceHtml(params: VendorOutgoingInvoiceParams): string {
  const content = `
    <div class="law-banner">
      <div>
        <div class="vendor-name">${escapeHtml(params.vendorName)}</div>
      </div>
      <div class="vendor-address">${params.vendorAddress ? multiline(params.vendorAddress) : ""}</div>
    </div>
    <div class="gold-rule"></div>
    <div class="info-row">
      <div>
        <div class="label">Bill To</div>
        <div class="bill-name">${escapeHtml(params.billToName)}</div>
        ${params.billToAddress ? `<div class="address">${multiline(params.billToAddress)}</div>` : ""}
      </div>
      <div class="meta">
        ${params.invoiceNumber ? `<div><span>Invoice #</span> ${escapeHtml(params.invoiceNumber)}</div>` : ""}
        <div><span>Date</span> ${escapeHtml(formatDate(params.invoiceDate))}</div>
        <h1>INVOICE</h1>
      </div>
    </div>
    <table class="vendor-lines">
      <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
      <tbody>${lineRows(params.lines)}</tbody>
    </table>
    <div class="total-box"><div>Total</div><strong>${formatUsd(params.totalUsd)}</strong></div>
    ${params.notes ? `<div class="notes"><strong>Notes:</strong><br />${multiline(params.notes)}</div>` : ""}
    <footer><div></div><p>Confidential - Prepared for Rock Hill Innovation Co., Ltd</p></footer>
    ${buildVendorBankingPage(params)}
  `;

  return buildBaseHtml({
    content,
    styles: `
      .law-banner { background:#1a2744; color:#fff; display:flex; justify-content:space-between; padding:20px 40px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .vendor-name { font-size:16pt; font-weight:700; }
      .vendor-address { font-size:9pt; line-height:1.5; max-width:3.4in; text-align:right; }
      .gold-rule { border-top:2px solid #C9A84C; margin-bottom:24px; }
      .info-row { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
      .bill-name { color:#1a2744; font-weight:700; }
      .address { color:#555; font-size:9pt; line-height:1.6; }
      .meta { color:#1a2744; text-align:right; }
      .meta span { color:#666; font-size:8pt; font-weight:700; text-transform:uppercase; }
      .meta h1 { color:#1a2744; font-size:22pt; font-weight:700; letter-spacing:3px; margin:14px 0 0; }
      .vendor-lines { border-collapse:collapse; width:100%; }
      .vendor-lines th { background:#1a2744; color:#fff; padding:9px 10px; text-align:left; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .vendor-lines td { border-bottom:1px solid #ccc; padding:8px 10px; }
      .vendor-lines .amount { text-align:right; width:1.6in; }
      .total-box { color:#1a2744; display:flex; font-weight:700; justify-content:space-between; margin:18px 0 28px auto; width:2.6in; }
      .notes { color:#555; margin:18px 0; }
      footer div { border-top:2px solid #C9A84C; margin-top:28px; }
      footer p { color:#777; font-size:8.5pt; margin-top:8px; text-align:center; }
    `,
    title: `Invoice ${params.invoiceNumber ?? params.invoiceDate}`,
  });
}
