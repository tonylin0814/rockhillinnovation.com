import type { SupplierInvoiceParams } from "@/lib/templates/supplier-invoices/types";

const categoryLabels: Record<string, string> = {
  adjustment: "调整",
  misc_expense: "杂项",
  outsourced: "委外",
  produced: "自产",
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

export function buildJicaiInvoiceHtml({
  exchangeRate,
  invoiceDate,
  invoiceNumber,
  invoiceType,
  lines,
  notes,
  supplierAddress,
  supplierBanking,
  supplierName,
  supplierNameChinese,
  totalRmb,
  totalUsd,
}: SupplierInvoiceParams): string {
  const invoiceTypeLabel = invoiceType === "deposit" ? "定金付款通知" : "尾款付款通知";
  const invoiceTypeSub = invoiceType === "deposit" ? "Supplier Deposit Invoice" : "Supplier Final Invoice";
  const supplierNameDisplay = escapeHtml(supplierNameChinese ?? supplierName ?? "供应商");
  const supplierBankingNameDisplay = escapeHtml(supplierName ?? supplierNameChinese ?? "供应商");
  const tableRows = lines
    .map(
      (line, i) => `
        <tr class="${i % 2 === 1 ? "si-row-alt" : ""}">
          <td class="si-td si-td-chinese">${escapeHtml(line.descriptionChinese ?? line.descriptionEnglish ?? "-")}</td>
          <td class="si-td si-td-cat">${categoryLabels[line.paymentCategory] ?? line.paymentCategory}</td>
          <td class="si-td si-td-center">
            <span class="si-pct-badge ${line.paymentPct < 100 ? "si-pct-deposit" : "si-pct-full"}">${line.paymentPct}%</span>
          </td>
          <td class="si-td si-td-right">${formatQuantity(line.quantity)}</td>
          <td class="si-td si-td-right">${formatUnitRmb(line.unitPriceRmb)}</td>
          <td class="si-td si-td-right si-td-amount">${formatRmb(line.totalRmb)}</td>
        </tr>`
    )
    .join("");
  const bankingPage = supplierBanking
    ? `
    <div class="page-break"></div>
    <div class="banking-page">
      <div class="banking-header">
        <div class="banking-title">${supplierBankingNameDisplay} 银行信息</div>
        <div class="banking-subtitle">电汇转账信息 - ${escapeHtml(invoiceNumber)}</div>
      </div>
      <table class="banking-table">
        <tbody>
          ${supplierBanking.accountName ? `<tr><td class="bk-label">账户名称</td><td class="bk-value">${escapeHtml(supplierBanking.accountName)}</td></tr>` : ""}
          ${supplierBanking.accountNumber ? `<tr><td class="bk-label">账号</td><td class="bk-value bk-mono">${escapeHtml(supplierBanking.accountNumber)}</td></tr>` : ""}
          ${supplierBanking.bankName ? `<tr><td class="bk-label">开户行</td><td class="bk-value">${escapeHtml(supplierBanking.bankName)}</td></tr>` : ""}
          ${supplierBanking.bankAddress ? `<tr><td class="bk-label">银行地址</td><td class="bk-value">${multiline(supplierBanking.bankAddress)}</td></tr>` : ""}
          ${supplierBanking.cnapsNo ? `<tr><td class="bk-label">联行号</td><td class="bk-value bk-mono">${escapeHtml(supplierBanking.cnapsNo)}</td></tr>` : ""}
          ${supplierBanking.swiftCode ? `<tr><td class="bk-label">SWIFT 代码</td><td class="bk-value bk-mono">${escapeHtml(supplierBanking.swiftCode)}</td></tr>` : ""}
          ${supplierBanking.currency ? `<tr><td class="bk-label">币种</td><td class="bk-value">${escapeHtml(supplierBanking.currency)}</td></tr>` : ""}
          ${supplierBanking.bankTel ? `<tr><td class="bk-label">银行电话</td><td class="bk-value">${escapeHtml(supplierBanking.bankTel)}</td></tr>` : ""}
        </tbody>
      </table>
      ${
        supplierBanking.bankingInstructions
          ? `<div class="banking-instructions">
               <div class="bk-instr-label">附加说明</div>
               <div class="bk-instr-body">${multiline(supplierBanking.bankingInstructions)}</div>
             </div>`
          : ""
      }
      <div class="banking-footer"></div>
    </div>`
    : "";

  return `<!doctype html>
<html lang="zh-Hans">
  <head>
    <meta charset="utf-8" />
    <title>供应商发票 ${escapeHtml(invoiceNumber)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        color: #1a1a1a;
        font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "STHeiti", system-ui, Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.5;
      }
      .no-break { page-break-inside: avoid; }
      .page-break { page-break-after: always; }
      .si-shell { display: flex; flex-direction: column; min-height: 9.4in; }
      .si-top-bar { align-items: flex-start; display: flex; justify-content: space-between; padding-bottom: 10px; }
      .si-issuer-name { color: #111827; font-size: 13pt; font-weight: 700; }
      .si-doctype-zh { color: #c2410c; font-size: 11pt; font-weight: 700; margin-top: 3px; }
      .si-doctype-en { color: #9ca3af; font-size: 7.5pt; letter-spacing: 0.06em; margin-top: 2px; }
      .si-top-right { text-align: right; }
      .si-inv-num { color: #1f2937; font-size: 14pt; font-weight: 700; }
      .si-inv-date { color: #6b7280; font-size: 9pt; margin-top: 3px; }
      .si-divider { border-top: 3px solid #c2410c; margin-bottom: 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .si-parties { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; margin-bottom: 14px; }
      .si-party-label { color: #9ca3af; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 3px; text-transform: uppercase; }
      .si-party-name { color: #111827; font-size: 10pt; font-weight: 700; }
      .si-party-detail { color: #6b7280; font-size: 8.5pt; line-height: 1.55; margin-top: 2px; }
      .si-party-right { border-left: 1px solid #e5e7eb; padding-left: 16px; }
      .si-rate-box { align-items: center; background: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid #c2410c; display: flex; gap: 12px; margin-bottom: 14px; padding: 8px 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .si-rate-label { color: #92400e; font-size: 8pt; font-weight: 700; letter-spacing: 0.08em; }
      .si-rate-value { color: #7c2d12; font-size: 12pt; font-variant-numeric: tabular-nums; font-weight: 700; }
      .si-table { border-collapse: collapse; margin-bottom: 4px; width: 100%; }
      .si-th { background: #f3f4f6; border-bottom: 2px solid #d1d5db; border-top: 2px solid #d1d5db; color: #374151; font-size: 8.5pt; font-weight: 700; padding: 9px 10px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .si-th-chinese { width: 40%; }
      .si-th-narrow { width: 0.65in; }
      .si-th-unit { width: 1in; }
      .si-th-amount { width: 1.15in; }
      .si-th-center { text-align: center; }
      .si-th-right { text-align: right; }
      .si-td { border: none; border-bottom: 1px solid #f3f4f6; color: #1f2937; font-size: 10pt; padding: 8px 10px; vertical-align: middle; }
      .si-td-chinese { font-size: 10.5pt; font-weight: 500; }
      .si-td-cat { color: #6b7280; font-size: 9pt; }
      .si-td-center { text-align: center; }
      .si-td-right { font-variant-numeric: tabular-nums; text-align: right; }
      .si-td-amount { font-size: 9.5pt; font-weight: 600; }
      .si-row-alt td { background: #f9fafb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .si-pct-badge { border-radius: 3px; display: inline-block; font-size: 8pt; font-weight: 700; padding: 2px 7px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .si-pct-deposit { background: #fef3c7; color: #92400e; }
      .si-pct-full { background: #d1fae5; color: #065f46; }
      .si-totals { margin: 14px 0 24px auto; width: 2.8in; }
      .si-total-row { align-items: baseline; display: flex; font-size: 9.5pt; justify-content: space-between; padding: 4px 0; }
      .si-total-label { color: #374151; }
      .si-total-val { color: #1f2937; font-variant-numeric: tabular-nums; font-weight: 600; }
      .si-total-divider { border-top: 2px solid #c2410c; margin: 6px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .si-grand .si-total-label { color: #111827; font-size: 10pt; font-weight: 700; }
      .si-total-grand { color: #c2410c; font-size: 13pt; font-variant-numeric: tabular-nums; font-weight: 700; }
      .si-notes { margin-top: 18px; }
      .si-notes-label { color: #9ca3af; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 4px; text-transform: uppercase; }
      .si-notes p { color: #374151; font-size: 8.5pt; margin: 0; }
      .si-footer { border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 7.5pt; margin-top: auto; padding-top: 28px; text-align: center; }
      .banking-page { padding-top: 8px; }
      .banking-header { border-bottom: 3px solid #c2410c; margin-bottom: 20px; padding-bottom: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .banking-title { color: #111827; font-size: 14pt; font-weight: 700; }
      .banking-subtitle { color: #6b7280; font-size: 8.5pt; margin-top: 3px; }
      .banking-table { border-collapse: collapse; margin-bottom: 20px; width: 100%; }
      .bk-label { border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 8.5pt; font-weight: 700; padding: 10px 16px 10px 0; vertical-align: top; width: 1.8in; }
      .bk-value { border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 10.5pt; line-height: 1.5; padding: 10px 0; vertical-align: top; }
      .bk-mono { font-family: "Courier New", Courier, monospace; font-size: 10pt; letter-spacing: 0.05em; }
      .banking-instructions { background: #f9fafb; border: 1px solid #e5e7eb; border-left: 4px solid #c2410c; margin-bottom: 20px; padding: 12px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .bk-instr-label { color: #9ca3af; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 6px; text-transform: uppercase; }
      .bk-instr-body { color: #374151; font-size: 9.5pt; line-height: 1.6; }
      .banking-footer { border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 7.5pt; margin-top: 24px; padding-top: 14px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="si-shell">
      <div class="si-top-bar">
        <div>
          <div class="si-issuer-name">${supplierNameDisplay}</div>
          <div class="si-doctype-zh">${invoiceTypeLabel}</div>
          <div class="si-doctype-en">${invoiceTypeSub}</div>
        </div>
        <div class="si-top-right">
          <div class="si-inv-num"># ${escapeHtml(invoiceNumber)}</div>
          <div class="si-inv-date">${escapeHtml(invoiceDate)}</div>
        </div>
      </div>

      <div class="si-divider"></div>

      <section class="si-parties no-break">
        <div class="si-party">
          <div class="si-party-label">供应商 / Supplier</div>
          <div class="si-party-name">${supplierNameDisplay}</div>
          ${supplierAddress ? `<div class="si-party-detail">${multiline(supplierAddress)}</div>` : ""}
        </div>
        <div class="si-party si-party-right">
          <div class="si-party-label">付款方 / Payer</div>
          <div class="si-party-name">Rock Hill Innovation Inc.</div>
          <div class="si-party-detail">内部付款参考 / Internal Payment Reference</div>
        </div>
      </section>

      ${
        exchangeRate
          ? `<div class="si-rate-box no-break">
               <span class="si-rate-label">约定汇率 / Agreed Exchange Rate</span>
               <span class="si-rate-value">¥${exchangeRate.toFixed(4)} / $1 USD</span>
             </div>`
          : ""
      }

      <table class="si-table">
        <thead>
          <tr>
            <th class="si-th si-th-chinese">商品名称</th>
            <th class="si-th">类别</th>
            <th class="si-th si-th-center">付款比例</th>
            <th class="si-th si-th-right si-th-narrow">数量</th>
            <th class="si-th si-th-right si-th-unit">单价</th>
            <th class="si-th si-th-right si-th-amount">金额（人民币）</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <div class="si-totals no-break">
        <div class="si-total-row">
          <span class="si-total-label">合计（人民币）</span>
          <span class="si-total-val">${formatRmb(totalRmb)}</span>
        </div>
        ${
          exchangeRate && totalUsd != null
            ? `<div class="si-total-divider"></div>
               <div class="si-total-row si-grand">
                 <span class="si-total-label">美元等值</span>
                 <strong class="si-total-grand">${formatUsd(totalUsd)}</strong>
               </div>`
            : `<div class="si-total-divider"></div>`
        }
      </div>

      ${
        notes
          ? `<section class="si-notes no-break">
               <div class="si-notes-label">备注</div>
               <p>${multiline(notes)}</p>
             </section>`
          : ""
      }

    </div>
    ${bankingPage}
  </body>
</html>`;
}
