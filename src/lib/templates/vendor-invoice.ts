import { buildBaseHtml } from "@/lib/templates/base";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function multiline(value: string | null) {
  return escapeHtml(value ?? "").replace(/\n/g, "<br />");
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

export function buildVendorInvoiceHtml({
  amountUsd,
  billToName,
  description,
  invoiceDate,
  invoiceNumber,
  letterheadBase64,
  letterheadMimeType,
  notes,
  vendorAddress,
  vendorName,
}: {
  vendorName: string;
  vendorAddress: string | null;
  billToName: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  amountUsd: number;
  description: string | null;
  notes: string | null;
  letterheadBase64: string | null;
  letterheadMimeType: string | null;
}): string {
  const hasLetterhead =
    Boolean(letterheadBase64) &&
    Boolean(letterheadMimeType) &&
    (letterheadMimeType?.startsWith("image/png") ||
      letterheadMimeType?.startsWith("image/jpeg") ||
      letterheadMimeType?.startsWith("image/webp"));
  const backgroundImage = hasLetterhead ? `data:${letterheadMimeType};base64,${letterheadBase64}` : null;
  const safeInvoiceNumber = invoiceNumber ? escapeHtml(invoiceNumber) : null;
  const safeDate = escapeHtml(formatDate(invoiceDate));

  const lineTable = `
    <table class="vendor-line-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount">Amount (USD)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(description ?? "Professional Services")}</td>
          <td class="amount">${formatUsd(amountUsd)}</td>
        </tr>
      </tbody>
    </table>`;

  const invoiceBody = `
    <section class="vendor-party no-break">
      <div class="vendor-label">Bill To</div>
      <div class="vendor-bill-name">${escapeHtml(billToName)}</div>
    </section>
    ${lineTable}
    <div class="vendor-total no-break">
      <div class="vendor-total-rule"></div>
      <div class="vendor-total-row">
        <span>Total (USD)</span>
        <strong>${formatUsd(amountUsd)}</strong>
      </div>
    </div>
    ${
      notes
        ? `<section class="vendor-notes no-break">
            <div class="vendor-label">Notes</div>
            <p>${multiline(notes)}</p>
          </section>`
        : ""
    }`;

  const content = hasLetterhead
    ? `
      <div class="letterhead-shell">
        <img alt="" class="letterhead-bg" src="${backgroundImage}" />
        <div class="letterhead-content">
          <div class="letterhead-meta">
            ${safeInvoiceNumber ? `<span><strong>Invoice #</strong> ${safeInvoiceNumber}</span>` : ""}
            <span><strong>Date:</strong> ${safeDate}</span>
          </div>
          ${invoiceBody}
        </div>
      </div>`
    : `
      <div class="clean-vendor-shell">
        <header class="clean-vendor-header">
          <div>
            <div class="clean-vendor-name">${escapeHtml(vendorName)}</div>
            ${vendorAddress ? `<div class="clean-vendor-address">${multiline(vendorAddress)}</div>` : ""}
          </div>
          <div class="clean-vendor-meta">
            <div class="clean-vendor-title">INVOICE</div>
            ${safeInvoiceNumber ? `<div class="clean-vendor-number">${safeInvoiceNumber}</div>` : ""}
            <div>${safeDate}</div>
          </div>
        </header>
        ${invoiceBody}
        <footer class="clean-vendor-footer">${escapeHtml(vendorName)}</footer>
      </div>`;

  return buildBaseHtml({
    content,
    styles: `
      .letterhead-shell { min-height:9.35in; position:relative; }
      .letterhead-bg { height:100%; left:0; min-height:9.35in; object-fit:contain; object-position:top left; position:absolute; top:0; width:100%; z-index:0; }
      .letterhead-content { padding:2in 0.85in 1.75in; position:relative; z-index:1; }
      .letterhead-meta { color:#333; display:flex; font-size:10pt; gap:24px; margin-bottom:18px; }
      .clean-vendor-shell { display:flex; flex-direction:column; min-height:8.65in; }
      .clean-vendor-header { align-items:flex-start; border-bottom:3px solid #0d1b34; display:flex; justify-content:space-between; margin-bottom:24px; padding-bottom:16px; }
      .clean-vendor-name { color:#0d1b34; font-size:18pt; font-weight:800; }
      .clean-vendor-address { color:#5a6270; font-size:9pt; line-height:1.6; margin-top:5px; max-width:3.8in; }
      .clean-vendor-meta { color:#5a6270; font-size:9pt; text-align:right; }
      .clean-vendor-title { background:#0d1b34; color:#fff; font-size:17pt; font-weight:700; letter-spacing:.08em; margin-bottom:10px; padding:10px 22px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .clean-vendor-number { color:#0d1b34; font-weight:700; }
      .vendor-label { color:#5a6270; font-size:7.5pt; font-weight:700; letter-spacing:.1em; margin-bottom:4px; text-transform:uppercase; }
      .vendor-party { margin-bottom:20px; }
      .vendor-bill-name { color:#0d1b34; font-weight:700; margin-top:4px; }
      .vendor-line-table { border-collapse:collapse; margin-top:12px; width:100%; }
      .vendor-line-table thead tr { background:#0d1b34; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .vendor-line-table th { background:#0d1b34; color:#fff; font-size:8.5pt; font-weight:600; padding:10px; text-align:left; }
      .vendor-line-table td { border-top:1px solid #e4e6ea; font-size:9pt; padding:9px 10px; vertical-align:top; }
      .vendor-line-table tr:nth-child(even) td { background:#f5f6f8; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .vendor-line-table .amount { text-align:right; width:1.5in; }
      .vendor-total { margin:14px 0 24px auto; width:2.5in; }
      .vendor-total-rule { border-top:2px solid #0d1b34; margin-bottom:8px; }
      .vendor-total-row { color:#0d1b34; display:flex; font-size:13pt; font-weight:700; justify-content:space-between; }
      .vendor-notes { color:#5a6270; margin-top:16px; }
      .vendor-notes p { margin-top:4px; }
      .clean-vendor-footer { color:#5a6270; margin-top:auto; padding-top:36px; text-align:center; }
    `,
    title: `Invoice ${invoiceNumber ?? invoiceDate} - ${vendorName}`,
  });
}
