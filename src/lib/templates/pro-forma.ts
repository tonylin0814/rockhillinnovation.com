import { buildBaseHtml } from "@/lib/templates/base";

type ProFormaLine = {
  description: string;
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

export function buildProFormaHtml({
  clientAddress,
  clientName,
  currency,
  invoiceDate,
  invoiceNumber,
  invoiceType = "pro_forma",
  lines,
  notes,
  subtotal,
  total,
}: {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType?: "pro_forma" | "deposit" | "final";
  clientName: string;
  clientAddress: string | null;
  lines: ProFormaLine[];
  subtotal: number;
  total: number;
  notes: string | null;
  currency: string;
}): string {
  const invoiceTypeLabel = {
    deposit: "Deposit Invoice",
    final: "Final Invoice",
    pro_forma: "Pro-Forma Invoice",
  }[invoiceType];
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

        <section class="bill-to no-break">
          <div class="label">Bill To</div>
          <div class="client-name">${escapeHtml(clientName)}</div>
          ${clientAddress ? `<div class="client-address">${multiline(clientAddress)}</div>` : ""}
        </section>

        <table class="line-items">
          <thead>
            <tr>
              <th>Description</th>
              <th class="amount qty-column">Qty</th>
              <th class="amount price-column">Unit Price</th>
              <th class="amount price-column">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lines
              .map(
                (line) => `
                  <tr>
                    <td>${escapeHtml(line.description)}</td>
                    <td class="amount">${formatQuantity(line.quantity)}</td>
                    <td class="amount">${formatUsd(line.unitPrice)}</td>
                    <td class="amount">${formatUsd(line.total)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals no-break">
          <div class="total-line">
            <span>Subtotal</span>
            <strong>${formatUsd(subtotal)}</strong>
          </div>
          <div class="total-rule"></div>
          <div class="total-line grand-total">
            <span>Total (${escapeHtml(currency)})</span>
            <strong>${formatUsd(total)}</strong>
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
      </div>

      <footer class="document-footer">
        <p>Thank you for your business.</p>
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

      .bill-to {
        margin-bottom: 24px;
      }

      .client-name {
        color: #0d1b34;
        font-weight: 700;
        margin-top: 4px;
      }

      .client-address {
        color: #333;
        margin-top: 4px;
        white-space: normal;
      }

      .line-items {
        margin-top: 16px;
      }

      .qty-column {
        width: 0.9in;
      }

      .price-column {
        width: 1.35in;
      }

      .totals {
        margin: 16px 0 28px auto;
        width: 2.6in;
      }

      .total-line {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
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
    title: `Pro-Forma Invoice ${invoiceNumber}`,
  });
}
