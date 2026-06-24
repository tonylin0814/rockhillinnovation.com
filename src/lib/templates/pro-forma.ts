import { buildBaseHtml } from "@/lib/templates/base";
import type { CompanySettings, InvoiceAdjustmentLine } from "@/types";

type InvoiceLine = {
  itemCode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type BuildProFormaParams = {
  adjustmentLines?: InvoiceAdjustmentLine[];
  billToAddress?: string | null;
  billToName?: string;
  clientAddress?: string | null;
  clientName?: string;
  companyInfo?: CompanySettings | null;
  currency: string;
  depositDueDate?: string | null;
  depositPct?: number;
  invoiceDate: string;
  invoiceNumber: string;
  invoiceType?: "pro_forma" | "deposit" | "final" | "commercial";
  lines: InvoiceLine[];
  logoBase64?: string | null;
  notes: string | null;
  orderedBy?: string | null;
  paymentTerms?: string | null;
  shipToAddress?: string | null;
  shipToName?: string | null;
  subtotal: number;
  total?: number;
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

function companyAddressLines(companyInfo: CompanySettings | null) {
  return [
    companyInfo?.address_line1 ?? "5F., No. 7, Ln. 332, Sec. 2, Zhongshan Rd., Zhonghe Dist.",
    companyInfo?.address_line2,
    companyInfo?.city_state ?? "New Taipei City, Taiwan 235026",
  ].filter(Boolean);
}

function companyContactLine(companyInfo: CompanySettings | null) {
  return [companyInfo?.email ?? "packaging@rockhill.com.tw", companyInfo?.phone ?? "(+886)2-22452580"]
    .filter(Boolean)
    .map((value) => escapeHtml(value!))
    .join(" &nbsp;|&nbsp; ");
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildProFormaHtml({
  adjustmentLines = [],
  billToAddress,
  billToName,
  clientAddress,
  clientName,
  companyInfo = null,
  currency,
  depositDueDate = null,
  depositPct = 50,
  invoiceDate,
  invoiceNumber,
  lines,
  logoBase64 = null,
  notes,
  orderedBy = null,
  paymentTerms = null,
  shipToAddress = null,
  shipToName = null,
  subtotal,
}: BuildProFormaParams): string {
  const resolvedBillToName = billToName ?? clientName ?? "";
  const resolvedBillToAddress = billToAddress ?? clientAddress ?? null;
  const adjustmentsTotal = adjustmentLines.reduce((sum, adjustment) => sum + adjustment.amount_usd, 0);
  const grandTotal = round2(subtotal + adjustmentsTotal);
  const depositAmount = round2((grandTotal * depositPct) / 100);
  const balanceAmount = round2(grandTotal - depositAmount);
  const showSchedule = depositPct > 0 && depositPct < 100;

  const companyName = companyInfo?.company_name ?? "ROCK HILL INNOVATION CO., LTD";
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="${escapeHtml(companyName)}" class="doc-logo" />`
    : `<div style="color:#0d1b34;font-size:16pt;font-weight:800;letter-spacing:0.02em;margin-bottom:6px;">${escapeHtml(companyName)}</div>`;
  const addressLines = companyAddressLines(companyInfo);
  const contactLine = companyContactLine(companyInfo);

  const adjustmentsHtml = adjustmentLines.length
    ? `<table class="adjustments-table no-break">
        <thead>
          <tr>
            <th>Adjustment</th>
            <th class="amount" style="width:1.8in;">Amount (${escapeHtml(currency)})</th>
          </tr>
        </thead>
        <tbody>
          ${adjustmentLines
            .map(
              (adjustment) => `<tr>
                <td>${escapeHtml(adjustment.description)}</td>
                <td class="amount" style="${adjustment.amount_usd < 0 ? "color:#c0392b;" : "color:#0d1b34;"}font-weight:600;">
                  ${adjustment.amount_usd >= 0 ? "+" : ""}${formatUsd(adjustment.amount_usd)}
                </td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>`
    : "";

  const paymentScheduleHtml = showSchedule
    ? `<div class="payment-schedule no-break">
        <div class="payment-schedule-title">Payment Schedule</div>
        <table>
          <thead>
            <tr>
              <th>Milestone</th>
              <th class="amount" style="width:1.6in;">Amount (${escapeHtml(currency)})</th>
              <th class="amount" style="width:1.6in;">Due</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="milestone-label">Deposit (${depositPct}%)</td>
              <td class="milestone-amount">${formatUsd(depositAmount)}</td>
              <td class="milestone-due">${depositDueDate ? escapeHtml(depositDueDate) : "Upon confirmation"}</td>
            </tr>
            <tr>
              <td class="milestone-label">Balance (${100 - depositPct}%)</td>
              <td class="milestone-amount">${formatUsd(balanceAmount)}</td>
              <td class="milestone-due">${paymentTerms ? escapeHtml(paymentTerms) : "Prior to shipment"}</td>
            </tr>
          </tbody>
        </table>
      </div>`
    : paymentTerms
      ? `<div class="info-block no-break"><strong>Payment Terms:</strong> ${escapeHtml(paymentTerms)}</div>`
      : "";

  const content = `
    <div class="doc-header">
      <div>
        ${logoHtml}
        ${addressLines.map((line) => `<div class="doc-address-line">${escapeHtml(line!)}</div>`).join("")}
        ${contactLine ? `<div class="doc-address-line">${contactLine}</div>` : ""}
      </div>
      <div class="doc-type-badge">INVOICE</div>
    </div>

    <table class="doc-meta-table">
      <tr>
        <td class="doc-meta-label">Invoice No:</td>
        <td class="doc-meta-value-bold">${escapeHtml(invoiceNumber)}</td>
      </tr>
      <tr>
        <td class="doc-meta-label">Invoice Date:</td>
        <td class="doc-meta-value">${escapeHtml(invoiceDate)}</td>
      </tr>
      ${orderedBy ? `<tr><td class="doc-meta-label">Ordered By:</td><td class="doc-meta-value">${escapeHtml(orderedBy)}</td></tr>` : ""}
    </table>

    <div class="doc-parties no-break">
      <div>
        <div class="label">Bill To</div>
        <div class="doc-party-name">${escapeHtml(resolvedBillToName)}</div>
        ${resolvedBillToAddress ? `<div class="doc-party-address">${multiline(resolvedBillToAddress)}</div>` : ""}
      </div>
      ${
        shipToName
          ? `<div>
              <div class="label">Ship To</div>
              <div class="doc-party-name">${escapeHtml(shipToName)}</div>
              ${shipToAddress ? `<div class="doc-party-address">${multiline(shipToAddress)}</div>` : ""}
            </div>`
          : "<div></div>"
      }
    </div>

    <table class="line-items">
      <thead>
        <tr>
          <th style="width:11%;">Item #</th>
          <th>Description</th>
          <th class="amount" style="width:10%;">Qty</th>
          <th class="amount" style="width:13%;">Unit Price</th>
          <th class="amount" style="width:13%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lines
          .map(
            (line) => `<tr class="no-break">
              <td class="item-code">${escapeHtml(line.itemCode ?? "")}</td>
              <td>${escapeHtml(line.description)}</td>
              <td class="amount">${formatQuantity(line.quantity)}</td>
              <td class="amount">${formatUsd(line.unitPrice)}</td>
              <td class="amount" style="font-weight:700;color:#0d1b34;">${formatUsd(line.total)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>

    ${adjustmentsHtml}

    <div class="totals-block no-break">
      ${
        adjustmentLines.length
          ? `<div class="totals-row"><span style="color:#555;">Subtotal</span><span>${formatUsd(subtotal)}</span></div>`
          : ""
      }
      <div class="totals-divider"></div>
      <div class="totals-row totals-grand">
        <span>Grand Total (${escapeHtml(currency)}):</span>
        <span>${formatUsd(grandTotal)}</span>
      </div>
    </div>

    ${paymentScheduleHtml}

    ${notes ? `<div class="info-block no-break"><strong>Notes:</strong> ${multiline(notes)}</div>` : ""}
  `;

  return buildBaseHtml({ companyInfo, content, logoBase64, title: `Invoice ${invoiceNumber}` });
}
