import { buildBaseHtml } from "@/lib/templates/base";

type QuotationLine = {
  itemCode: string | null;
  description: string;
  notes: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 3,
  }).format(value);
}

function multiline(value: string | null) {
  return escapeHtml(value ?? "").replace(/\n/g, "<br />");
}

export function buildClientQuotationHtml({
  billToAddress,
  billToName,
  currency,
  lines,
  logoBase64,
  notes,
  quotationDate,
  quotationRef,
  total,
  validUntil,
}: {
  quotationRef: string;
  quotationDate: string;
  validUntil: string | null;
  billToName: string;
  billToAddress: string | null;
  lines: QuotationLine[];
  total: number;
  notes: string | null;
  currency: string;
  logoBase64: string | null;
}): string {
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Rock Hill Innovation" class="doc-logo" />`
    : `<div style="color:#0d1b34;font-size:16pt;font-weight:800;margin-bottom:6px;">ROCK HILL INNOVATION CO., LTD</div>`;

  const content = `
    <div class="doc-header">
      <div>
        ${logoHtml}
        <div class="doc-address-line">5F., No. 7, Ln. 332, Sec. 2, Zhongshan Rd., Zhonghe Dist.</div>
        <div class="doc-address-line">New Taipei City, Taiwan 235026</div>
        <div class="doc-address-line">packaging@rockhill.com.tw &nbsp;|&nbsp; (+886)2-22452580</div>
      </div>
      <div class="doc-type-badge">QUOTATION</div>
    </div>

    <table class="doc-meta-table">
      <tr>
        <td class="doc-meta-label">Quotation Ref:</td>
        <td class="doc-meta-value-bold">${escapeHtml(quotationRef)}</td>
      </tr>
      <tr>
        <td class="doc-meta-label">Date:</td>
        <td class="doc-meta-value">${escapeHtml(quotationDate)}</td>
      </tr>
      ${
        validUntil
          ? `<tr>
              <td class="doc-meta-label">Valid Until:</td>
              <td class="doc-meta-value">${escapeHtml(validUntil)}</td>
            </tr>`
          : ""
      }
    </table>

    <div class="doc-parties no-break">
      <div>
        <div class="label">Prepared For</div>
        <div class="doc-party-name">${escapeHtml(billToName)}</div>
        ${billToAddress ? `<div class="doc-party-address">${multiline(billToAddress)}</div>` : ""}
      </div>
      <div>
        <div class="label">Prepared By</div>
        <div class="doc-party-name">Rock Hill Innovation Co., Ltd</div>
        <div class="doc-party-address">
          5F., No. 7, Ln. 332, Sec. 2, Zhongshan Rd.<br />
          Zhonghe Dist., New Taipei City 235026, Taiwan
        </div>
      </div>
    </div>

    <table class="line-items">
      <thead>
        <tr>
          <th style="width:11%;">Item #</th>
          <th>Description</th>
          <th class="amount" style="width:10%;">Qty</th>
          <th class="amount" style="width:13%;">Unit Price</th>
          <th class="amount" style="width:13%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lines
          .map(
            (line) => `<tr class="no-break">
              <td class="item-code">${escapeHtml(line.itemCode ?? "")}</td>
              <td>
                ${escapeHtml(line.description)}
                ${line.notes ? `<div class="item-note">${multiline(line.notes)}</div>` : ""}
              </td>
              <td class="amount">${formatQuantity(line.quantity)}</td>
              <td class="amount">${formatUsd(line.unitPrice)}</td>
              <td class="amount" style="font-weight:700;color:#0d1b34;">${formatUsd(line.total)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <div class="totals-block no-break">
      <div class="totals-divider"></div>
      <div class="totals-row totals-grand">
        <span>Total (${escapeHtml(currency)}):</span>
        <span>${formatUsd(total)}</span>
      </div>
    </div>

    ${
      validUntil
        ? `<div class="info-block no-break">
            <strong>Validity:</strong> This quotation is valid until ${escapeHtml(validUntil)}.
            Prices are subject to change after this date.
          </div>`
        : ""
    }

    ${notes ? `<div class="info-block no-break"><strong>Notes:</strong> ${multiline(notes)}</div>` : ""}
  `;

  return buildBaseHtml({ content, logoBase64, title: `Quotation ${quotationRef}` });
}
