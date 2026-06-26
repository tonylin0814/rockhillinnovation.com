import { buildBaseHtml } from "@/lib/templates/base";

export interface SupplierBanking {
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  bankAddress: string | null;
  cnapsNo: string | null;
  swiftCode: string | null;
  currency: string | null;
  bankTel: string | null;
  bankingInstructions: string | null;
}

export type SupplierInvoiceLine = {
  descriptionChinese: string | null;
  descriptionEnglish: string | null;
  paymentPct: number;
  quantity: number;
  unitPriceRmb: number;
  totalRmb: number;
  paymentCategory: "outsourced" | "produced" | "misc_expense" | "adjustment";
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRmb(value: number) {
  return `¥${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
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

const categoryLabels: Record<SupplierInvoiceLine["paymentCategory"], string> = {
  adjustment: "Adjustment",
  misc_expense: "Misc Expense",
  outsourced: "Outsourced",
  produced: "Produced",
};

export function buildSupplierInvoiceOutgoingHtml({
  exchangeRate,
  invoiceDate,
  invoiceNumber,
  invoiceType,
  lines,
  notes,
  supplierAddress,
  supplierBanking,
  supplierName,
  totalRmb,
  totalUsd,
}: {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: "deposit" | "final";
  supplierName: string | null;
  supplierAddress: string | null;
  supplierBanking: SupplierBanking | null;
  lines: SupplierInvoiceLine[];
  totalRmb: number;
  exchangeRate: number | null;
  totalUsd: number | null;
  notes: string | null;
}): string {
  const invoiceTypeLabel = invoiceType === "deposit" ? "DEPOSIT PAYMENT ORDER" : "FINAL PAYMENT ORDER";
  const invoiceTypeSub = invoiceType === "deposit" ? "Supplier Deposit Invoice" : "Supplier Final Invoice";

  const bankingPage = supplierBanking
    ? `
    <div class="page-break"></div>
    <div class="banking-page">
      <div class="banking-header">
        <div class="banking-title">Supplier Banking Information</div>
        <div class="banking-subtitle">Wire Transfer Details - ${escapeHtml(supplierName ?? "")} - ${escapeHtml(invoiceNumber)}</div>
      </div>
      <table class="banking-table">
        <tbody>
          ${supplierBanking.accountName ? `<tr><td class="bk-label">Account Name</td><td class="bk-value">${escapeHtml(supplierBanking.accountName)}</td></tr>` : ""}
          ${supplierBanking.accountNumber ? `<tr><td class="bk-label">Account Number</td><td class="bk-value bk-mono">${escapeHtml(supplierBanking.accountNumber)}</td></tr>` : ""}
          ${supplierBanking.bankName ? `<tr><td class="bk-label">Bank Name</td><td class="bk-value">${escapeHtml(supplierBanking.bankName)}</td></tr>` : ""}
          ${supplierBanking.bankAddress ? `<tr><td class="bk-label">Bank Address</td><td class="bk-value">${multiline(supplierBanking.bankAddress)}</td></tr>` : ""}
          ${supplierBanking.cnapsNo ? `<tr><td class="bk-label">CNAPS No.</td><td class="bk-value bk-mono">${escapeHtml(supplierBanking.cnapsNo)}</td></tr>` : ""}
          ${supplierBanking.swiftCode ? `<tr><td class="bk-label">SWIFT / BIC</td><td class="bk-value bk-mono">${escapeHtml(supplierBanking.swiftCode)}</td></tr>` : ""}
          ${supplierBanking.currency ? `<tr><td class="bk-label">Currency</td><td class="bk-value">${escapeHtml(supplierBanking.currency)}</td></tr>` : ""}
          ${supplierBanking.bankTel ? `<tr><td class="bk-label">Bank Tel</td><td class="bk-value">${escapeHtml(supplierBanking.bankTel)}</td></tr>` : ""}
        </tbody>
      </table>
      ${
        supplierBanking.bankingInstructions
          ? `<div class="banking-instructions">
               <div class="bk-instr-label">Additional Instructions</div>
               <div class="bk-instr-body">${multiline(supplierBanking.bankingInstructions)}</div>
             </div>`
          : ""
      }
      <div class="banking-footer">Internal use only - Rock Hill Innovation Inc.</div>
    </div>`
    : "";

  const content = `
    <div class="si-shell">
      <div class="si-top-bar">
        <div class="si-top-left">
          <div class="si-company">Rock Hill Innovation Inc.</div>
          <div class="si-doctype">${invoiceTypeLabel}</div>
        </div>
        <div class="si-top-right">
          <div class="si-inv-num"># ${escapeHtml(invoiceNumber)}</div>
          <div class="si-inv-sub">${escapeHtml(invoiceTypeSub)}</div>
          <div class="si-inv-date">${escapeHtml(invoiceDate)}</div>
        </div>
      </div>

      <div class="si-divider"></div>

      <section class="si-parties no-break">
        <div class="si-party">
          <div class="si-party-label">From</div>
          <div class="si-party-name">Rock Hill Innovation Inc.</div>
          <div class="si-party-detail">Internal Payment Reference</div>
        </div>
        <div class="si-party si-party-right">
          <div class="si-party-label">Supplier</div>
          <div class="si-party-name">${escapeHtml(supplierName ?? "-")}</div>
          ${supplierAddress ? `<div class="si-party-detail">${multiline(supplierAddress)}</div>` : ""}
        </div>
      </section>

      ${
        exchangeRate
          ? `<div class="si-rate-box no-break">
               <span class="si-rate-label">Agreed Exchange Rate</span>
               <span class="si-rate-value">¥${exchangeRate.toFixed(4)} / $1 USD</span>
             </div>`
          : ""
      }

      <table class="si-table">
        <thead>
          <tr>
            <th class="si-th si-th-chinese">品名 / Item</th>
            <th class="si-th">Category</th>
            <th class="si-th si-th-center">Payment</th>
            <th class="si-th si-th-right si-th-narrow">Qty</th>
            <th class="si-th si-th-right si-th-amount">Amount (RMB)</th>
          </tr>
        </thead>
        <tbody>
          ${lines
            .map(
              (line, i) => `
              <tr class="${i % 2 === 1 ? "si-row-alt" : ""}">
                <td class="si-td si-td-chinese">${escapeHtml(line.descriptionChinese ?? line.descriptionEnglish ?? "-")}</td>
                <td class="si-td si-td-cat">${categoryLabels[line.paymentCategory] ?? line.paymentCategory}</td>
                <td class="si-td si-td-center">
                  <span class="si-pct-badge ${line.paymentPct < 100 ? "si-pct-deposit" : "si-pct-full"}">${line.paymentPct}%</span>
                </td>
                <td class="si-td si-td-right">${formatQuantity(line.quantity)}</td>
                <td class="si-td si-td-right si-td-amount">${formatRmb(line.totalRmb)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <div class="si-totals no-break">
        <div class="si-total-row">
          <span class="si-total-label">Total (RMB)</span>
          <span class="si-total-val">${formatRmb(totalRmb)}</span>
        </div>
        ${
          exchangeRate && totalUsd != null
            ? `<div class="si-total-divider"></div>
               <div class="si-total-row si-grand">
                 <span class="si-total-label">USD Equivalent</span>
                 <strong class="si-total-grand">${formatUsd(totalUsd)}</strong>
               </div>`
            : `<div class="si-total-divider"></div>`
        }
      </div>

      ${
        notes
          ? `<section class="si-notes no-break">
               <div class="si-notes-label">Notes</div>
               <p>${multiline(notes)}</p>
             </section>`
          : ""
      }

      <div class="si-footer">Rock Hill Innovation Inc. - Internal Payment Reference - Not for external distribution</div>
    </div>

    ${bankingPage}
  `;

  return buildBaseHtml({
    content,
    styles: `
      .si-shell {
        display: flex;
        flex-direction: column;
        min-height: 9.4in;
      }

      .si-top-bar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0 0 12px;
      }

      .si-company {
        font-size: 13pt;
        font-weight: 700;
        color: #111827;
        letter-spacing: 0.01em;
      }

      .si-doctype {
        font-size: 8pt;
        font-weight: 700;
        letter-spacing: 0.18em;
        color: #c2410c;
        text-transform: uppercase;
        margin-top: 4px;
      }

      .si-top-right {
        text-align: right;
      }

      .si-inv-num {
        font-size: 15pt;
        font-weight: 700;
        color: #1f2937;
      }

      .si-inv-sub {
        font-size: 8.5pt;
        color: #6b7280;
        margin-top: 2px;
      }

      .si-inv-date {
        font-size: 9pt;
        color: #374151;
        margin-top: 3px;
      }

      .si-divider {
        border-top: 3px solid #c2410c;
        margin-bottom: 16px;
      }

      .si-parties {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }

      .si-party-label {
        font-size: 7.5pt;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #9ca3af;
        margin-bottom: 3px;
      }

      .si-party-name {
        font-size: 10pt;
        font-weight: 700;
        color: #111827;
      }

      .si-party-detail {
        font-size: 8.5pt;
        color: #6b7280;
        line-height: 1.55;
        margin-top: 2px;
      }

      .si-party-right {
        border-left: 1px solid #e5e7eb;
        padding-left: 16px;
      }

      .si-rate-box {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #fff7ed;
        border: 1px solid #fed7aa;
        border-left: 4px solid #c2410c;
        padding: 7px 14px;
        margin-bottom: 16px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .si-rate-label {
        font-size: 8pt;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #92400e;
      }

      .si-rate-value {
        font-size: 11pt;
        font-weight: 700;
        color: #7c2d12;
        font-variant-numeric: tabular-nums;
      }

      .si-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 4px;
      }

      .si-th {
        background: #f3f4f6;
        color: #374151;
        font-size: 8pt;
        font-weight: 700;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        padding: 9px 10px;
        border-top: 2px solid #d1d5db;
        border-bottom: 2px solid #d1d5db;
        text-align: left;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .si-th-chinese { width: 38%; }
      .si-th-narrow { width: 0.6in; }
      .si-th-amount { width: 1.15in; }
      .si-th-center { text-align: center; }
      .si-th-right { text-align: right; }

      .si-td {
        border: none;
        border-bottom: 1px solid #f3f4f6;
        font-size: 9.5pt;
        padding: 8px 10px;
        vertical-align: middle;
        color: #1f2937;
      }

      .si-td-chinese {
        font-size: 10pt;
        font-weight: 500;
      }

      .si-td-cat {
        font-size: 8.5pt;
        color: #6b7280;
      }

      .si-td-center { text-align: center; }
      .si-td-right {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .si-td-amount {
        font-weight: 600;
      }

      .si-row-alt td {
        background: #f9fafb;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .si-pct-badge {
        display: inline-block;
        font-size: 8pt;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 3px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .si-pct-deposit {
        background: #fef3c7;
        color: #92400e;
      }

      .si-pct-full {
        background: #d1fae5;
        color: #065f46;
      }

      .si-totals {
        margin: 14px 0 24px auto;
        width: 2.8in;
      }

      .si-total-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 4px 0;
        font-size: 9.5pt;
      }

      .si-total-label { color: #374151; }
      .si-total-val {
        font-variant-numeric: tabular-nums;
        color: #1f2937;
        font-weight: 600;
      }

      .si-total-divider {
        border-top: 2px solid #c2410c;
        margin: 6px 0;
      }

      .si-grand .si-total-label {
        font-weight: 600;
        color: #111827;
      }

      .si-total-grand {
        font-size: 13pt;
        font-weight: 700;
        color: #c2410c;
        font-variant-numeric: tabular-nums;
      }

      .si-notes {
        margin-top: 18px;
      }

      .si-notes-label {
        font-size: 7.5pt;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #9ca3af;
        margin-bottom: 4px;
      }

      .si-notes p {
        font-size: 8.5pt;
        color: #374151;
        margin: 0;
      }

      .si-footer {
        margin-top: auto;
        padding-top: 32px;
        font-size: 7.5pt;
        color: #9ca3af;
        text-align: center;
        border-top: 1px solid #e5e7eb;
      }

      .banking-page {
        padding-top: 8px;
      }

      .banking-header {
        border-bottom: 3px solid #c2410c;
        padding-bottom: 10px;
        margin-bottom: 20px;
      }

      .banking-title {
        font-size: 14pt;
        font-weight: 700;
        color: #111827;
      }

      .banking-subtitle {
        font-size: 8.5pt;
        color: #6b7280;
        margin-top: 3px;
      }

      .banking-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }

      .bk-label {
        width: 2in;
        font-size: 8pt;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6b7280;
        padding: 10px 16px 10px 0;
        border-bottom: 1px solid #f3f4f6;
        vertical-align: top;
      }

      .bk-value {
        font-size: 10.5pt;
        color: #111827;
        padding: 10px 0;
        border-bottom: 1px solid #f3f4f6;
        vertical-align: top;
        line-height: 1.5;
      }

      .bk-mono {
        font-family: "Courier New", Courier, monospace;
        font-size: 10pt;
        letter-spacing: 0.05em;
      }

      .banking-instructions {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-left: 4px solid #c2410c;
        padding: 12px 16px;
        margin-bottom: 20px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .bk-instr-label {
        font-size: 7.5pt;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #9ca3af;
        margin-bottom: 6px;
      }

      .bk-instr-body {
        font-size: 9.5pt;
        color: #374151;
        line-height: 1.6;
      }

      .banking-footer {
        margin-top: auto;
        font-size: 7.5pt;
        color: #9ca3af;
        text-align: center;
        border-top: 1px solid #e5e7eb;
        padding-top: 16px;
      }
    `,
    title: `Supplier Invoice ${invoiceNumber}`,
  });
}
