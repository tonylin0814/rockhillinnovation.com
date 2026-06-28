import { buildBaseHtml } from "@/lib/templates/base";
import { buildVendorBankingPage, escapeHtml, formatDate, formatUsd, lineRows, multiline } from "@/lib/templates/vendor-invoices/shared";
import type { VendorOutgoingInvoiceParams } from "@/lib/templates/vendor-invoices/types";

export function buildSgracoInvoiceHtml(params: VendorOutgoingInvoiceParams): string {
  const content = `
    <div class="top-row">
      <div>
        <div class="sgraco">SGRACO</div>
        <div class="sub">CONSULTING INC.</div>
        ${params.vendorAddress ? `<div class="vendor-address">${multiline(params.vendorAddress)}</div>` : ""}
      </div>
      <div class="invoice-meta">
        ${
          params.invoiceNumber
            ? `<div class="meta-row"><span>Invoice #</span><strong>${escapeHtml(params.invoiceNumber)}</strong></div>`
            : ""
        }
        <div class="meta-row"><span>Date</span><strong>${escapeHtml(formatDate(params.invoiceDate))}</strong></div>
      </div>
    </div>
    <div class="teal-rule"></div>
    <section class="bill-to">
      <div>BILL TO</div>
      <strong>${escapeHtml(params.billToName)}</strong>
      ${params.billToAddress ? `<p>${multiline(params.billToAddress)}</p>` : ""}
    </section>
    <table class="vendor-lines">
      <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
      <tbody>${lineRows(params.lines)}</tbody>
    </table>
    <div class="total-box"><span>Total</span><strong>${formatUsd(params.totalUsd)}</strong></div>
    ${params.notes ? `<div class="notes"><strong>Notes:</strong><br />${multiline(params.notes)}</div>` : ""}
    ${buildVendorBankingPage({ ...params, showPaymentNotice: false })}
  `;

  return buildBaseHtml({
    content,
    styles: `
      .top-row { display:flex; justify-content:space-between; gap:24px; }
      .sgraco { color:#1e293b; font-size:28pt; font-weight:900; letter-spacing:-1px; line-height:1; }
      .sub { color:#0D9488; font-size:8pt; font-weight:600; letter-spacing:4px; margin-top:4px; }
      .vendor-address { color:#64748b; font-size:9pt; line-height:1.5; margin-top:10px; }
      .invoice-meta { color:#1e293b; min-width:1.7in; text-align:right; }
      .meta-row { margin-bottom:8px; }
      .meta-row span { color:#0D9488; display:block; font-size:7.5pt; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
      .meta-row strong { color:#1e293b; display:block; font-size:10pt; }
      .teal-rule { border-top:2px solid #0D9488; margin:20px 0; }
      .bill-to { margin-bottom:22px; }
      .bill-to div { color:#0D9488; font-size:8pt; letter-spacing:2px; }
      .bill-to strong { color:#1e293b; font-weight:600; }
      .bill-to p { color:#64748b; }
      .vendor-lines { border-collapse:collapse; width:100%; }
      .vendor-lines th { border-bottom:2px solid #1e293b; color:#1e293b; font-size:9pt; letter-spacing:.5px; padding:8px 10px; text-align:left; text-transform:uppercase; }
      .vendor-lines td { border-bottom:1px solid #e2e8f0; padding:8px 10px; }
      .vendor-lines tbody tr:last-child td { border-bottom:1px solid #0D9488; }
      .vendor-lines .amount { text-align:right; width:1.6in; }
      .total-box { align-items:center; display:flex; justify-content:flex-end; gap:12px; margin:18px 0 28px auto; }
      .total-box span { color:#64748b; font-weight:700; }
      .total-box strong { background:#0D9488; border-radius:4px; color:#fff; font-size:13pt; font-weight:700; padding:10px 16px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .notes { color:#64748b; margin:18px 0; }
    `,
    title: `Invoice ${params.invoiceNumber ?? params.invoiceDate}`,
  });
}
