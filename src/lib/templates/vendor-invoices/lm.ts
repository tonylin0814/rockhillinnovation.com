import { buildBaseHtml } from "@/lib/templates/base";
import { bankingRows, escapeHtml, formatDate, formatUsd, hasBankingDetails, lineRows, multiline } from "@/lib/templates/vendor-invoices/shared";
import type { VendorOutgoingInvoiceParams } from "@/lib/templates/vendor-invoices/types";

export function buildLmInvoiceHtml(params: VendorOutgoingInvoiceParams): string {
  const bankingHtml = hasBankingDetails(params.vendorBanking)
    ? `<section class="banking no-break">
        <h2>Banking Information</h2>
        ${bankingRows(params.vendorBanking)
          .map(([label, value]) => `<p><span>${escapeHtml(label)}:</span> ${multiline(value)}</p>`)
          .join("")}
      </section>`
    : "";

  const content = `
    <div class="clean-shell">
      <div class="top-row">
        <div class="brand">
          <div class="initials">LM</div>
          <div class="vendor-name">${escapeHtml(params.vendorName)}</div>
          ${params.vendorAddress ? `<div class="vendor-address">${multiline(params.vendorAddress)}</div>` : ""}
        </div>
        <div class="invoice-head">
          <h1>INVOICE</h1>
          ${params.invoiceNumber ? `<p>Invoice # ${escapeHtml(params.invoiceNumber)}</p>` : ""}
          <p>${escapeHtml(formatDate(params.invoiceDate))}</p>
        </div>
      </div>
      <div class="divider"></div>
      <section class="bill-to">
        <div class="label">Bill To</div>
        <strong>${escapeHtml(params.billToName)}</strong>
        ${params.billToAddress ? `<div>${multiline(params.billToAddress)}</div>` : ""}
      </section>
      <table class="vendor-lines">
        <thead><tr><th>Description</th><th class="amount">Amount (USD)</th></tr></thead>
        <tbody>${lineRows(params.lines)}</tbody>
      </table>
      <div class="total-box"><span>Total</span><strong>${formatUsd(params.totalUsd)}</strong></div>
      ${params.notes ? `<div class="notes"><strong>Notes:</strong><br />${multiline(params.notes)}</div>` : ""}
      ${bankingHtml}
      <footer>${escapeHtml(params.vendorName)}<br /><span>${params.vendorAddress ? multiline(params.vendorAddress) : ""}</span></footer>
    </div>
  `;

  return buildBaseHtml({
    content,
    styles: `
      .clean-shell { border-left:3px solid #7B2D42; padding-left:22px; }
      .top-row { display:flex; justify-content:space-between; gap:24px; }
      .brand { min-height:88px; position:relative; }
      .initials { color:#f0dde2; font-size:48pt; font-weight:900; letter-spacing:-2px; line-height:1; position:absolute; z-index:0; }
      .vendor-name { color:#7B2D42; font-size:14pt; font-weight:700; padding-top:26px; position:relative; z-index:1; }
      .vendor-address { color:#555; font-size:9pt; line-height:1.5; position:relative; z-index:1; }
      .invoice-head { text-align:right; }
      .invoice-head h1 { color:#1a1a1a; font-size:26pt; font-weight:800; margin:0; }
      .invoice-head p { color:#555; font-size:10pt; margin:2px 0; }
      .divider { border-top:1px solid #e5c6cc; margin:18px 0; }
      .bill-to { color:#555; margin-bottom:20px; }
      .bill-to .label { color:#7B2D42; font-size:8pt; font-weight:700; letter-spacing:1px; }
      .bill-to strong { color:#1a1a1a; display:block; }
      .vendor-lines { border-collapse:collapse; width:100%; }
      .vendor-lines th { border-bottom:2px solid #7B2D42; color:#7B2D42; font-weight:700; padding:8px 10px; text-align:left; }
      .vendor-lines td { border-bottom:1px solid #eee; padding:8px 10px; }
      .vendor-lines .amount { text-align:right; width:1.6in; }
      .total-box { border-top:3px double #7B2D42; color:#7B2D42; display:flex; font-weight:700; justify-content:space-between; margin:20px 0 28px auto; padding-top:8px; width:2.6in; }
      .banking { background:#fdf7f8; border-left:3px solid #7B2D42; margin-top:24px; padding:12px 16px; }
      .banking h2 { color:#7B2D42; margin:0 0 8px; }
      .banking p { margin:3px 0; }
      .banking span { color:#888; }
      .notes { color:#555; margin:18px 0; }
      footer { color:#7B2D42; font-weight:700; margin-top:30px; text-align:center; }
      footer span { color:#888; font-weight:400; }
    `,
    title: `Invoice ${params.invoiceNumber ?? params.invoiceDate}`,
  });
}
