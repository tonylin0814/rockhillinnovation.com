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
    !!letterheadBase64 &&
    !!letterheadMimeType &&
    (letterheadMimeType.startsWith("image/png") ||
      letterheadMimeType.startsWith("image/jpeg") ||
      letterheadMimeType.startsWith("image/webp"));
  const backgroundImage = hasLetterhead ? `data:${letterheadMimeType};base64,${letterheadBase64}` : null;

  function invoiceBody({
    amountUsd,
    billToName,
    description,
    invoiceDate,
    invoiceNumber,
    notes,
  }: {
    billToName: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    amountUsd: number;
    description: string | null;
    notes: string | null;
  }) {
    return `
      <section class="bill-to no-break">
        <div class="label">Bill To</div>
        <div class="bill-to-name">${escapeHtml(billToName)}</div>
      </section>

      ${
        hasLetterhead
          ? `
            <div class="ref-line">
              ${invoiceNumber ? `<span><strong>Invoice #</strong> ${escapeHtml(invoiceNumber)}</span>` : ""}
              <span><strong>Date:</strong> ${escapeHtml(invoiceDate)}</span>
            </div>`
          : ""
      }

      <table class="line-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="amount price-col">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(description ?? "Professional Services")}</td>
            <td class="amount">${formatUsd(amountUsd)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals no-break">
        <div class="total-rule"></div>
        <div class="total-line grand-total">
          <span>Total (USD)</span>
          <strong>${formatUsd(amountUsd)}</strong>
        </div>
      </div>

      ${
        notes
          ? `<section class="notes no-break">
              <div class="label">Notes</div>
              <p>${multiline(notes)}</p>
            </section>`
          : ""
      }
    `;
  }

  const content = hasLetterhead
    ? `
      <div class="letterhead-shell">
        <img alt="" class="letterhead-bg" src="${backgroundImage}" />
        <div class="letterhead-content">
          ${invoiceBody({ amountUsd, billToName, description, invoiceDate, invoiceNumber, notes })}
        </div>
      </div>`
    : `
      <div class="clean-shell">
        <div class="header-block">
          <div>
            <div class="company-name">${escapeHtml(vendorName)}</div>
            ${vendorAddress ? `<div class="vendor-address">${multiline(vendorAddress)}</div>` : ""}
          </div>
          <div class="invoice-meta">
            ${invoiceNumber ? `<div class="invoice-number">Invoice # ${escapeHtml(invoiceNumber)}</div>` : ""}
            <div>${escapeHtml(invoiceDate)}</div>
          </div>
        </div>
        ${invoiceBody({ amountUsd, billToName, description, invoiceDate, invoiceNumber, notes })}
        <footer class="document-footer">
          <p>${escapeHtml(vendorName)}</p>
        </footer>
      </div>`;

  return buildBaseHtml({
    content,
    styles: `
      .letterhead-shell {
        min-height: 9.4in;
        position: relative;
      }

      .letterhead-bg {
        height: 100%;
        left: 0;
        min-height: 9.4in;
        object-fit: contain;
        object-position: top left;
        position: absolute;
        top: 0;
        width: 100%;
        z-index: 0;
      }

      .letterhead-content {
        padding: 2in 0.85in 1.75in;
        position: relative;
        z-index: 1;
      }

      .clean-shell {
        display: flex;
        flex-direction: column;
        min-height: 9.4in;
      }

      .vendor-address {
        color: #333;
        font-size: 10pt;
        margin-top: 2px;
      }

      .invoice-meta {
        color: #333;
        line-height: 1.5;
        text-align: right;
      }

      .invoice-number {
        color: #0d1b34;
        font-weight: 700;
      }

      .ref-line {
        color: #333;
        display: flex;
        font-size: 10.5pt;
        gap: 24px;
        margin-bottom: 18px;
      }

      .bill-to {
        margin-bottom: 20px;
      }

      .bill-to-name {
        color: #0d1b34;
        font-weight: 700;
        margin-top: 4px;
      }

      .line-items {
        margin-top: 12px;
      }

      .price-col {
        width: 1.35in;
      }

      .totals {
        margin: 12px 0 24px auto;
        width: 2.4in;
      }

      .total-rule {
        border-top: 1px solid #333;
        margin: 5px 0;
      }

      .total-line {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
      }

      .grand-total {
        color: #0d1b34;
        font-size: 13pt;
        font-weight: 700;
      }

      .notes {
        margin-top: 16px;
      }

      .notes p {
        margin-top: 4px;
      }

      .document-footer {
        color: #666;
        margin-top: auto;
        padding-top: 36px;
        text-align: center;
      }

      .document-footer p {
        margin: 2px 0;
      }
    `,
    title: `Invoice ${invoiceNumber ?? invoiceDate} - ${vendorName}`,
  });
}
