import { buildBaseHtml } from "@/lib/templates/base";
import type { CompanyBankingAccount, CompanySettings, InvoiceAdjustmentLine } from "@/types";

type InvoiceLine = {
  components?: {
    code: string | null;
    name: string;
    quantityPerSet: number;
  }[];
  itemCode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type BuildProFormaParams = {
  adjustmentLines?: InvoiceAdjustmentLine[];
  bankingAccount?: CompanyBankingAccount | null;
  balanceLine?: {
    amountUsd: number;
    label: string;
  } | null;
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

function formatComponentName(component: { code: string | null; name: string }) {
  if (component.code && /^MLP-ASSEMBLY(-\d+)?$/.test(component.code)) {
    return "MLP-ASSEMBLY - Assembly";
  }

  return component.code ? `${component.code} - ${component.name}` : component.name;
}

function buildBankingPage(
  account: CompanyBankingAccount | null,
  invoiceNumber: string,
  billToName: string,
  logoBase64: string | null,
  companyInfo: CompanySettings | null
): string {
  if (!account) return "";

  const companyName = companyInfo?.company_name ?? "ROCK HILL INNOVATION CO., LTD";
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="${escapeHtml(companyName)}" class="doc-logo" />`
    : `<div style="color:#0d1b34;font-size:16pt;font-weight:800;margin-bottom:6px;">${escapeHtml(companyName)}</div>`;

  const addressLines = [
    companyInfo?.address_line1 ?? "5F., No. 7, Ln. 332, Sec. 2, Zhongshan Rd., Zhonghe Dist.",
    companyInfo?.address_line2,
    companyInfo?.city_state ?? "New Taipei City, Taiwan 235026",
  ].filter(Boolean);
  const contactLine = [companyInfo?.email, companyInfo?.phone]
    .filter(Boolean)
    .map((value) => escapeHtml(value!))
    .join(" &nbsp;|&nbsp; ");

  const rows: Array<[string, string | null | undefined]> = [
    ["Bank", account.bank_name],
    ["Branch", account.bank_branch],
    ["Bank address", account.bank_address],
    ["Beneficiary", account.account_name],
    ["Account number", account.account_number],
    ["SWIFT / BIC", account.swift_code],
    ["Routing / ABA", account.routing_number],
    ["IBAN", account.iban],
    ["Intermediary bank", account.intermediary_bank],
  ];

  const rowsHtml = rows
    .filter(([, value]) => value)
    .map(
      ([label, value]) => `
      <tr>
        <td style="border:none;border-top:1px solid #eee;padding:11px 14px;font-size:9pt;color:#5a6270;white-space:nowrap;vertical-align:top;width:1.8in;">${escapeHtml(label)}</td>
        <td style="border:none;border-top:1px solid #eee;padding:11px 14px;font-size:10pt;color:#0d1b34;font-weight:600;">${escapeHtml(value!)}</td>
      </tr>`
    )
    .join("");

  const currencyLabel = account.label ?? `${account.currency} Wire Transfer`;

  return `
    <div class="page-break"></div>

    <div class="doc-header">
      <div>
        ${logoHtml}
        ${addressLines.map((line) => `<div class="doc-address-line">${escapeHtml(line!)}</div>`).join("")}
        ${contactLine ? `<div class="doc-address-line">${contactLine}</div>` : ""}
      </div>
      <div class="doc-type-badge" style="font-size:12pt;padding:10px 18px;white-space:nowrap;">BANKING INFO</div>
    </div>

    <div style="margin-bottom:22px;">
      <div style="font-size:8pt;color:#5a6270;margin-bottom:2px;">Re: Invoice</div>
      <div style="color:#0d1b34;font-weight:700;font-size:12pt;">
        ${escapeHtml(invoiceNumber)}
        <span style="font-weight:400;font-size:9pt;color:#5a6270;">- ${escapeHtml(billToName)}</span>
      </div>
      <div style="margin-top:12px;background:#f5f6f8;border-left:3px solid #0d1b34;padding:10px 16px;font-size:9pt;color:#444;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        Please wire your payment to the account below.
        <strong style="color:#0d1b34;">Always include your invoice number as the wire reference</strong>
        so we can match your payment immediately.
      </div>
    </div>

    <div style="border:1px solid #e4e6ea;border-radius:4px;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="background:#0d1b34;color:#fff;padding:12px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <span style="font-size:9pt;font-weight:600;letter-spacing:0.06em;opacity:0.7;">${escapeHtml(account.currency)}</span>
        &nbsp;&nbsp;
        <span style="font-size:11pt;font-weight:700;">${escapeHtml(currencyLabel)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:0;">${rowsHtml}</table>
      ${
        account.notes
          ? `
        <div style="padding:10px 14px;background:#f5f6f8;border-top:1px solid #e4e6ea;font-size:8.5pt;color:#5a6270;font-style:italic;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          ${escapeHtml(account.notes)}
        </div>`
          : ""
      }
    </div>

    <div style="margin-top:20px;background:#fff8e7;border:1px solid #f0d070;border-left:3px solid #d4a000;padding:10px 14px;font-size:8.5pt;color:#5a4200;border-radius:0 4px 4px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <strong>Important:</strong>
      Bank fees are the sender's responsibility. If your bank deducts a fee that results in a shortfall,
      please arrange an additional transfer to cover the difference.
    </div>`;
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
  bankingAccount = null,
  balanceLine = null,
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
  invoiceType,
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
  const invoiceSubtotal = balanceLine ? balanceLine.amountUsd : subtotal;
  const grandTotal = round2(invoiceSubtotal + adjustmentsTotal);
  const depositAmount = round2((grandTotal * depositPct) / 100);
  const balanceAmount = round2(grandTotal - depositAmount);
  const showSchedule = !balanceLine && depositPct > 0 && depositPct < 100;

  const companyName = companyInfo?.company_name ?? "ROCK HILL INNOVATION CO., LTD";
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="${escapeHtml(companyName)}" class="doc-logo" />`
    : `<div style="color:#0d1b34;font-size:16pt;font-weight:800;letter-spacing:0.02em;margin-bottom:6px;">${escapeHtml(companyName)}</div>`;
  const addressLines = companyAddressLines(companyInfo);
  const contactLine = companyContactLine(companyInfo);

  const adjustmentRowsHtml = adjustmentLines
    .map(
      (adjustment) => `<tr class="no-break">
        <td class="item-code"></td>
        <td>${escapeHtml(adjustment.description)}</td>
        <td class="amount">1</td>
        <td class="amount">${formatUsd(adjustment.amount_usd)}</td>
        <td class="amount" style="${adjustment.amount_usd < 0 ? "color:#c0392b;" : "color:#0d1b34;"}font-weight:700;">
          ${formatUsd(adjustment.amount_usd)}
        </td>
      </tr>`
    )
    .join("");

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

  const amountDueCalloutHtml = (() => {
    if (invoiceType === "deposit") {
      const dueNote = depositDueDate ? `Payable by ${escapeHtml(depositDueDate)}` : "Payable upon order confirmation";

      return `
      <div class="no-break" style="
        margin: 22px 0 0;
        background: #0d1b34;
        border-radius: 6px;
        padding: 24px 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      ">
        <div>
          <div style="
            font-size: 8pt;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #7fa8d4;
            margin-bottom: 4px;
          ">Deposit Due Now (${depositPct}%)</div>
          <div style="
            font-size: 7pt;
            color: #94a3b8;
            margin-top: 6px;
          ">${dueNote}</div>
        </div>
        <div style="
          font-size: 28pt;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.01em;
          white-space: nowrap;
        ">${formatUsd(depositAmount)}</div>
      </div>`;
    }

    if (invoiceType === "final") {
      const dueNote = paymentTerms ? escapeHtml(paymentTerms) : "Payable prior to shipment";

      return `
      <div class="no-break" style="
        margin: 22px 0 0;
        background: #1a3a2a;
        border-radius: 6px;
        padding: 24px 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      ">
        <div>
          <div style="
            font-size: 8pt;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #6dbf9e;
            margin-bottom: 4px;
          ">Balance Due</div>
          <div style="
            font-size: 7pt;
            color: #94a3b8;
            margin-top: 6px;
          ">${dueNote}</div>
        </div>
        <div style="
          font-size: 28pt;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.01em;
          white-space: nowrap;
        ">${formatUsd(grandTotal)}</div>
      </div>`;
    }

    return "";
  })();

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
          <th style="width:22%;">Item #</th>
          <th>Description</th>
          <th class="amount" style="width:9%;">Qty</th>
          <th class="amount" style="width:12%;">Unit Price</th>
          <th class="amount" style="width:12%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${
          balanceLine
            ? `<tr class="no-break">
              <td class="item-code"></td>
              <td>${escapeHtml(balanceLine.label)}</td>
              <td class="amount">1</td>
              <td class="amount">${formatUsd(balanceLine.amountUsd)}</td>
              <td class="amount" style="font-weight:700;color:#0d1b34;">${formatUsd(balanceLine.amountUsd)}</td>
            </tr>`
            : lines
                .map(
                  (line) => `<tr class="no-break">
              <td class="item-code">${escapeHtml(line.itemCode ?? "")}</td>
              <td>
                ${escapeHtml(line.description)}
                ${
                  line.components?.length
                    ? `<div class="item-note"><strong>Components:</strong><br />${line.components
                        .reduce<typeof line.components>((acc, comp) => {
                          const formatted = formatComponentName(comp);
                          if (acc.some((existing) => formatComponentName(existing) === formatted)) return acc;
                          return [...acc, comp];
                        }, [])
                        .map(
                          (component) =>
                            `${escapeHtml(formatComponentName(component))} x ${formatQuantity(component.quantityPerSet)}`
                        )
                        .join("<br />")}</div>`
                    : ""
                }
              </td>
              <td class="amount">${formatQuantity(line.quantity)}</td>
              <td class="amount">${formatUsd(line.unitPrice)}</td>
              <td class="amount" style="font-weight:700;color:#0d1b34;">${formatUsd(line.total)}</td>
            </tr>`
                )
                .join("")
        }
        ${adjustmentRowsHtml}
      </tbody>
    </table>

    <div class="totals-block no-break">
      ${
        adjustmentLines.length
              ? `<div class="totals-row"><span style="color:#555;">Subtotal</span><span>${formatUsd(invoiceSubtotal)}</span></div>`
          : ""
      }
      <div class="totals-divider"></div>
      <div class="totals-row totals-grand">
        <span>Grand Total (${escapeHtml(currency)}):</span>
        <span>${formatUsd(grandTotal)}</span>
      </div>
    </div>

    ${paymentScheduleHtml}

    ${amountDueCalloutHtml}

    ${notes ? `<div class="info-block no-break"><strong>Notes:</strong> ${multiline(notes)}</div>` : ""}

    ${buildBankingPage(bankingAccount, invoiceNumber, resolvedBillToName, logoBase64, companyInfo)}
  `;

  return buildBaseHtml({ companyInfo, content, logoBase64, title: `Invoice ${invoiceNumber}` });
}
