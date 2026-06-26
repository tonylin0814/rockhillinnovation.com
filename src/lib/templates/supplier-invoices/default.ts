import { buildBaseHtml } from "@/lib/templates/base";
import type { SupplierInvoiceParams } from "@/lib/templates/supplier-invoices/types";

const categoryLabels: Record<string, string> = {
  adjustment: "Adjustment",
  misc_expense: "Misc Expense",
  outsourced: "Outsourced",
  produced: "Produced",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRmb(value: number): string {
  return `¥${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

function formatUnitRmb(value: number): string {
  return `¥${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  }).format(value)}`;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 3,
  }).format(value);
}

function multiline(value: string | null): string {
  return escapeHtml(value ?? "").replace(/\n/g, "<br />");
}

export function buildDefaultSupplierInvoiceHtml({
  exchangeRate,
  invoiceDate,
  invoiceNumber,
  invoiceType,
  lines,
  notes,
  supplierAddress,
  supplierBanking,
  supplierName,
  supplierNameChinese: _supplierNameChinese,
  totalRmb,
  totalUsd,
}: SupplierInvoiceParams): string {
  const invoiceTypeLabel =
    invoiceType === "commercial"
      ? "Supplier Commercial Invoice"
      : invoiceType === "deposit"
        ? "Supplier Deposit Invoice"
        : "Supplier Final Invoice";
  const supplierNameDisplay = escapeHtml(supplierName ?? "-");
  const showPct = invoiceType !== "commercial";
  const bankingPage = supplierBanking
    ? `
    <div class="page-break"></div>
    <div class="def-banking">
      <div class="def-bk-header">
        <div class="def-bk-title">${supplierNameDisplay} - Banking Information</div>
        <div class="def-bk-sub">Wire Transfer Details - ${escapeHtml(invoiceNumber)}</div>
      </div>
      <table class="def-bk-table">
        <tbody>
          ${supplierBanking.accountName ? `<tr><td class="def-bk-label">Account Name</td><td class="def-bk-value">${escapeHtml(supplierBanking.accountName)}</td></tr>` : ""}
          ${supplierBanking.accountNumber ? `<tr><td class="def-bk-label">Account Number</td><td class="def-bk-value def-bk-mono">${escapeHtml(supplierBanking.accountNumber)}</td></tr>` : ""}
          ${supplierBanking.bankName ? `<tr><td class="def-bk-label">Bank Name</td><td class="def-bk-value">${escapeHtml(supplierBanking.bankName)}</td></tr>` : ""}
          ${supplierBanking.bankAddress ? `<tr><td class="def-bk-label">Bank Address</td><td class="def-bk-value">${multiline(supplierBanking.bankAddress)}</td></tr>` : ""}
          ${supplierBanking.cnapsNo ? `<tr><td class="def-bk-label">CNAPS No.</td><td class="def-bk-value def-bk-mono">${escapeHtml(supplierBanking.cnapsNo)}</td></tr>` : ""}
          ${supplierBanking.swiftCode ? `<tr><td class="def-bk-label">SWIFT / BIC</td><td class="def-bk-value def-bk-mono">${escapeHtml(supplierBanking.swiftCode)}</td></tr>` : ""}
          ${supplierBanking.currency ? `<tr><td class="def-bk-label">Currency</td><td class="def-bk-value">${escapeHtml(supplierBanking.currency)}</td></tr>` : ""}
          ${supplierBanking.bankTel ? `<tr><td class="def-bk-label">Bank Tel</td><td class="def-bk-value">${escapeHtml(supplierBanking.bankTel)}</td></tr>` : ""}
        </tbody>
      </table>
      ${
        supplierBanking.bankingInstructions
          ? `<div class="def-bk-instr">
               <div class="def-bk-instr-label">Additional Instructions</div>
               <div>${multiline(supplierBanking.bankingInstructions)}</div>
             </div>`
          : ""
      }
      <div class="def-bk-footer">Internal use only - Rock Hill Innovation Inc.</div>
    </div>`
    : "";
  const tableRows = lines
    .map(
      (line, i) => `
        <tr class="${i % 2 === 1 ? "def-row-alt" : ""}">
          <td class="def-td">${escapeHtml(line.descriptionChinese ?? line.descriptionEnglish ?? "-")}</td>
          <td class="def-td def-td-cat">${categoryLabels[line.paymentCategory] ?? line.paymentCategory}</td>
          <td class="def-td def-td-center">
            ${
              showPct
                ? `<span class="def-pct ${line.paymentPct < 100 ? "def-pct-dep" : "def-pct-full"}">${line.paymentPct}%</span>`
                : ""
            }
          </td>
          <td class="def-td def-td-right">${formatQuantity(line.quantity)}</td>
          <td class="def-td def-td-right">${formatUnitRmb(line.unitPriceRmb)}</td>
          <td class="def-td def-td-right def-td-amount">${formatRmb(line.totalRmb)}</td>
        </tr>`
    )
    .join("");

  return buildBaseHtml({
    content: `
      <div class="def-shell">
        <div class="def-header">
          <div>
            <div class="def-issuer">${supplierNameDisplay}</div>
            <div class="def-doctype">${invoiceTypeLabel}</div>
          </div>
          <div class="def-header-right">
            <div class="def-inv-num"># ${escapeHtml(invoiceNumber)}</div>
            <div class="def-inv-date">${escapeHtml(invoiceDate)}</div>
          </div>
        </div>

        <div class="def-divider"></div>

        <section class="def-parties no-break">
          <div class="def-party">
            <div class="def-party-label">Supplier</div>
            <div class="def-party-name">${supplierNameDisplay}</div>
            ${supplierAddress ? `<div class="def-party-detail">${multiline(supplierAddress)}</div>` : ""}
          </div>
          <div class="def-party def-party-right">
            <div class="def-party-label">Payer</div>
            <div class="def-party-name">Rock Hill Innovation Inc.</div>
            <div class="def-party-detail">Internal Payment Reference</div>
          </div>
        </section>

        ${
          exchangeRate
            ? `<div class="def-rate-box no-break">
                 <span class="def-rate-label">Agreed Exchange Rate</span>
                 <span class="def-rate-value">¥${exchangeRate.toFixed(4)} / $1 USD</span>
               </div>`
            : ""
        }

        <table class="def-table">
          <thead>
            <tr>
              <th class="def-th def-th-wide">Item</th>
              <th class="def-th">Category</th>
              <th class="def-th def-th-center">Payment</th>
              <th class="def-th def-th-right def-th-narrow">Qty</th>
              <th class="def-th def-th-right def-th-unit">Unit Price</th>
              <th class="def-th def-th-right def-th-amount">Amount (RMB)</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        <div class="def-totals no-break">
          <div class="def-total-row">
            <span class="def-total-label">Total (RMB)</span>
            <span class="def-total-val">${formatRmb(totalRmb)}</span>
          </div>
        ${
          exchangeRate && totalUsd != null
            ? `<div class="def-total-row" style="color:#6b7280;font-size:8pt;padding:2px 0;">
                 <span>÷ ${exchangeRate.toFixed(4)} RMB/USD</span>
                 <span></span>
               </div>
               <div class="def-total-divider"></div>
               <div class="def-total-row def-grand">
                   <span class="def-total-label">Grand Total (USD)</span>
                   <strong class="def-total-grand">${formatUsd(totalUsd)}</strong>
                 </div>`
            : `<div class="def-total-divider"></div>`
          }
        </div>

        ${
          notes
            ? `<section class="def-notes no-break">
                 <div class="def-notes-label">Notes</div>
                 <p>${multiline(notes)}</p>
               </section>`
            : ""
        }

        <div class="def-footer">Rock Hill Innovation Inc. - Internal Payment Reference - Not for external distribution</div>
      </div>
      ${bankingPage}
    `,
    styles: `
      .def-shell { display: flex; flex-direction: column; min-height: 9.4in; }
      .def-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; }
      .def-issuer { color: #111827; font-size: 13pt; font-weight: 700; }
      .def-doctype { color: #0f766e; font-size: 8pt; font-weight: 700; letter-spacing: 0.14em; margin-top: 4px; text-transform: uppercase; }
      .def-header-right { text-align: right; }
      .def-inv-num { color: #1f2937; font-size: 14pt; font-weight: 700; }
      .def-inv-date { color: #6b7280; font-size: 9pt; margin-top: 3px; }
      .def-divider { border-top: 3px solid #0f766e; margin-bottom: 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .def-parties { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; margin-bottom: 14px; }
      .def-party-label { color: #9ca3af; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.12em; margin-bottom: 3px; text-transform: uppercase; }
      .def-party-name { color: #111827; font-size: 10pt; font-weight: 700; }
      .def-party-detail { color: #6b7280; font-size: 8.5pt; line-height: 1.55; margin-top: 2px; }
      .def-party-right { border-left: 1px solid #e5e7eb; padding-left: 16px; }
      .def-rate-box { align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #0f766e; display: flex; gap: 12px; margin-bottom: 14px; padding: 8px 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .def-rate-label { color: #065f46; font-size: 8pt; font-weight: 700; letter-spacing: 0.08em; }
      .def-rate-value { color: #064e3b; font-size: 12pt; font-variant-numeric: tabular-nums; font-weight: 700; }
      .def-table { border-collapse: collapse; margin-bottom: 4px; width: 100%; }
      .def-th { background: #f3f4f6; border-bottom: 2px solid #d1d5db; border-top: 2px solid #d1d5db; color: #374151; font-size: 8.5pt; font-weight: 700; padding: 9px 10px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .def-th-wide { width: 40%; }
      .def-th-narrow { width: 0.65in; }
      .def-th-unit { width: 1in; }
      .def-th-amount { width: 1.15in; }
      .def-th-center { text-align: center; }
      .def-th-right { text-align: right; }
      .def-td { border: none; border-bottom: 1px solid #f3f4f6; color: #1f2937; font-size: 9.5pt; padding: 8px 10px; vertical-align: middle; }
      .def-td-cat { color: #6b7280; font-size: 8.5pt; }
      .def-td-center { text-align: center; }
      .def-td-right { font-variant-numeric: tabular-nums; text-align: right; }
      .def-td-amount { font-weight: 600; }
      .def-row-alt td { background: #f9fafb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .def-pct { border-radius: 3px; display: inline-block; font-size: 8pt; font-weight: 700; padding: 2px 7px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .def-pct-dep { background: #fef3c7; color: #92400e; }
      .def-pct-full { background: #d1fae5; color: #065f46; }
      .def-totals { margin: 14px 0 24px auto; width: 2.8in; }
      .def-total-row { align-items: baseline; display: flex; font-size: 9.5pt; justify-content: space-between; padding: 4px 0; }
      .def-total-label { color: #374151; }
      .def-total-val { color: #1f2937; font-variant-numeric: tabular-nums; font-weight: 600; }
      .def-total-divider { border-top: 2px solid #0f766e; margin: 6px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .def-grand .def-total-label { color: #111827; font-size: 10pt; font-weight: 700; }
      .def-total-grand { color: #0f766e; font-size: 13pt; font-variant-numeric: tabular-nums; font-weight: 700; }
      .def-notes { margin-top: 18px; }
      .def-notes-label { color: #9ca3af; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 4px; text-transform: uppercase; }
      .def-notes p { color: #374151; font-size: 8.5pt; margin: 0; }
      .def-footer { border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 7.5pt; margin-top: auto; padding-top: 28px; text-align: center; }
      .def-banking { padding-top: 8px; }
      .def-bk-header { border-bottom: 3px solid #0f766e; margin-bottom: 20px; padding-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .def-bk-title { color: #111827; font-size: 14pt; font-weight: 700; }
      .def-bk-sub { color: #6b7280; font-size: 8.5pt; margin-top: 3px; }
      .def-bk-table { border-collapse: collapse; margin-bottom: 20px; width: 100%; }
      .def-bk-label { border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 8.5pt; font-weight: 700; padding: 10px 16px 10px 0; vertical-align: top; width: 1.8in; }
      .def-bk-value { border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 10.5pt; line-height: 1.5; padding: 10px 0; vertical-align: top; }
      .def-bk-mono { font-family: "Courier New", Courier, monospace; font-size: 10pt; letter-spacing: 0.05em; }
      .def-bk-instr { background: #f9fafb; border: 1px solid #e5e7eb; border-left: 4px solid #0f766e; margin-bottom: 20px; padding: 12px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .def-bk-instr-label { color: #9ca3af; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 6px; text-transform: uppercase; }
      .def-bk-footer { border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 7.5pt; margin-top: 24px; padding-top: 14px; text-align: center; }
    `,
    title: `Supplier Invoice ${invoiceNumber}`,
  });
}
