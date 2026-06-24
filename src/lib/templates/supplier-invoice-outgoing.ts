import { buildBaseHtml } from "@/lib/templates/base";

export type SupplierInvoiceLine = {
  descriptionChinese: string | null;
  descriptionEnglish: string | null;
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
  return `\u00A5${new Intl.NumberFormat("en-US", {
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
  supplierName,
  totalRmb,
  totalUsd,
}: {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: "deposit" | "final";
  supplierName: string | null;
  supplierAddress: string | null;
  lines: SupplierInvoiceLine[];
  totalRmb: number;
  exchangeRate: number | null;
  totalUsd: number | null;
  notes: string | null;
}): string {
  const invoiceTypeLabel = invoiceType === "deposit" ? "Supplier Deposit Invoice" : "Supplier Final Invoice";

  const content = `
    <div class="document-shell">
      <div>
        <div class="header-block">
          <div>
            <div class="company-name">Rock Hill Innovation</div>
            <div class="muted-title">${invoiceTypeLabel}</div>
          </div>
          <div class="invoice-meta">
            <div class="invoice-number">Invoice # ${escapeHtml(invoiceNumber)}</div>
            <div>${escapeHtml(invoiceDate)}</div>
          </div>
        </div>

        <section class="supplier-block no-break">
          <div class="label">Supplier</div>
          <div class="supplier-name">${escapeHtml(supplierName ?? "-")}</div>
          ${supplierAddress ? `<div class="supplier-address">${multiline(supplierAddress)}</div>` : ""}
        </section>

        <table class="line-items">
          <thead>
            <tr>
              <th>Item (Chinese)</th>
              <th>Item (English)</th>
              <th>Category</th>
              <th class="amount qty-col">Qty</th>
              <th class="amount price-col">Unit Price</th>
              <th class="amount price-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lines
              .map(
                (line) => `
                  <tr>
                    <td>${escapeHtml(line.descriptionChinese ?? "-")}</td>
                    <td>${escapeHtml(line.descriptionEnglish ?? "-")}</td>
                    <td class="category-cell">${categoryLabels[line.paymentCategory] ?? line.paymentCategory}</td>
                    <td class="amount">${formatQuantity(line.quantity)}</td>
                    <td class="amount">${formatRmb(line.unitPriceRmb)}</td>
                    <td class="amount">${formatRmb(line.totalRmb)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals no-break">
          <div class="total-line">
            <span>Total (RMB)</span>
            <strong>${formatRmb(totalRmb)}</strong>
          </div>
          ${
            exchangeRate && totalUsd != null
              ? `
                <div class="total-line rate-line">
                  <span>Exchange Rate</span>
                  <span>\u00A5${exchangeRate.toFixed(4)} / $1</span>
                </div>
                <div class="total-rule"></div>
                <div class="total-line grand-total">
                  <span>USD Equivalent</span>
                  <strong>${formatUsd(totalUsd)}</strong>
                </div>`
              : `<div class="total-rule"></div>`
          }
        </div>

        ${
          notes
            ? `<section class="notes no-break">
                <div class="label">Notes</div>
                <p>${multiline(notes)}</p>
              </section>`
            : ""
        }
      </div>

      <footer class="document-footer">
        <p>Rock Hill Innovation - Internal Payment Reference</p>
        <p>sales@rockhillinnovation.com | www.rockhillinnovation.com</p>
      </footer>
    </div>
  `;

  return buildBaseHtml({
    content,
    styles: `
      .document-shell {
        display: flex;
        flex-direction: column;
        min-height: 9.4in;
      }

      .muted-title {
        color: #666;
        font-size: 11pt;
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

      .supplier-block {
        margin-bottom: 24px;
      }

      .supplier-name {
        color: #0d1b34;
        font-weight: 700;
        margin-top: 4px;
      }

      .supplier-address {
        color: #333;
        margin-top: 4px;
      }

      .line-items {
        margin-top: 16px;
      }

      .qty-col {
        width: 0.7in;
      }

      .price-col {
        width: 1.25in;
      }

      .category-cell {
        color: #555;
        font-size: 9.5pt;
      }

      .totals {
        margin: 16px 0 28px auto;
        width: 3in;
      }

      .total-line {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
      }

      .rate-line {
        color: #555;
        font-size: 9.5pt;
      }

      .total-rule {
        border-top: 1px solid #333;
        margin: 5px 0;
      }

      .grand-total {
        color: #0d1b34;
        font-size: 13pt;
        font-weight: 700;
      }

      .notes {
        margin-top: 18px;
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
    title: `Supplier Invoice ${invoiceNumber}`,
  });
}
