export function buildBaseHtml({
  companyInfo = null,
  content,
  logoBase64 = null,
  styles = "",
  title,
}: {
  title: string;
  content: string;
  logoBase64?: string | null;
  companyInfo?: {
    email: string | null;
    phone: string | null;
    website: string | null;
  } | null;
  styles?: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }

      body {
        color: #1a1a1a;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.45;
        padding-bottom: 0;
      }

      p { margin: 0 0 8px; }

      .no-break { page-break-inside: avoid; }
      .page-break { page-break-after: always; }

      .label {
        color: #5a6270;
        font-size: 7.5pt;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-bottom: 4px;
      }

      .amount {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      .page-footer-bar {
        position: fixed;
        bottom: -0.28in;
        left: -0.75in;
        right: -0.75in;
        height: 8px;
        background: #0d1b34;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page-footer-contact {
        position: fixed;
        bottom: -0.2in;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 8pt;
        color: #5a6270;
      }

      .doc-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-top: 6px;
        padding-bottom: 14px;
        border-bottom: 3px solid #0d1b34;
        margin-bottom: 16px;
      }

      .doc-logo {
        height: 52px;
        width: auto;
        display: block;
        margin-bottom: 6px;
      }

      .doc-address-line {
        color: #5a6270;
        font-size: 8pt;
        line-height: 1.6;
      }

      .doc-type-badge {
        background: #0d1b34;
        color: #fff;
        font-size: 17pt;
        font-weight: 700;
        letter-spacing: 0.08em;
        padding: 10px 22px;
        white-space: nowrap;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .doc-meta-table {
        border: none;
        margin: 0 0 18px;
        width: auto;
        margin-left: auto;
      }

      .doc-meta-table td {
        border: none;
        padding: 2px 0;
        vertical-align: top;
      }

      .doc-meta-label {
        color: #5a6270;
        font-size: 8.5pt;
        padding-right: 12px !important;
        text-align: right;
        white-space: nowrap;
      }

      .doc-meta-value { color: #1a1a1a; font-size: 9pt; min-width: 120px; }
      .doc-meta-value-bold { color: #0d1b34; font-size: 9.5pt; font-weight: 700; min-width: 120px; }

      .doc-parties {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 18px;
      }

      .doc-party-name { color: #0d1b34; font-size: 10pt; font-weight: 700; margin-bottom: 3px; }
      .doc-party-address { color: #444; font-size: 9pt; line-height: 1.6; }

      .line-items {
        width: 100%;
        border-collapse: collapse;
        margin: 0 0 4px;
      }

      .line-items thead tr {
        background: #0d1b34;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .line-items th {
        background: #0d1b34;
        border: none;
        color: #fff;
        font-size: 8.5pt;
        font-weight: 600;
        padding: 12px 10px 8px;
        text-align: left;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .line-items th.amount { text-align: right; }

      .line-items td {
        border: none;
        border-top: 1px solid #e4e6ea;
        font-size: 9pt;
        padding: 8px 10px;
        vertical-align: top;
      }

      .line-items tr:nth-child(even) td {
        background: #f5f6f8;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .line-items .item-code { color: #0d1b34; font-weight: 700; }
      .line-items .item-note { color: #666; font-size: 8.5pt; padding-top: 2px; }

      .totals-block {
        margin: 12px 0 20px auto;
        width: 3.2in;
      }

      .totals-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        font-size: 9.5pt;
      }

      .totals-divider { border-top: 2.5px solid #0d1b34; margin: 6px 0; }

      .totals-grand { color: #0d1b34; font-size: 12pt; font-weight: 700; }

      .payment-schedule {
        margin-bottom: 16px;
      }

      .payment-schedule-title {
        color: #0d1b34;
        font-size: 8.5pt;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .payment-schedule table {
        width: 100%;
        border-collapse: collapse;
      }

      .payment-schedule th {
        background: #f5f6f8;
        border: none;
        border-top: 1px solid #e4e6ea;
        border-bottom: 1px solid #e4e6ea;
        color: #5a6270;
        font-size: 8pt;
        font-weight: 600;
        letter-spacing: 0.07em;
        padding: 6px 10px;
        text-align: left;
        text-transform: uppercase;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .payment-schedule th.amount { text-align: right; }

      .payment-schedule td {
        border: none;
        border-top: 1px solid #eee;
        font-size: 9pt;
        padding: 7px 10px;
        vertical-align: middle;
      }

      .payment-schedule .milestone-label { font-weight: 600; color: #0d1b34; }
      .payment-schedule .milestone-amount { font-weight: 700; color: #0d1b34; text-align: right; }
      .payment-schedule .milestone-due { color: #555; font-size: 8.5pt; text-align: right; }

      .adjustments-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0 0 4px;
      }

      .adjustments-table th {
        background: #f5f6f8;
        border: none;
        border-top: 1px solid #e4e6ea;
        border-bottom: 1px solid #e4e6ea;
        color: #5a6270;
        font-size: 8pt;
        font-weight: 600;
        letter-spacing: 0.08em;
        padding: 6px 10px;
        text-align: left;
        text-transform: uppercase;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .adjustments-table th.amount { text-align: right; }

      .adjustments-table td {
        border: none;
        border-top: 1px solid #eee;
        font-size: 9pt;
        padding: 6px 10px;
        vertical-align: top;
      }

      .info-block {
        background: #f5f6f8;
        border-left: 3px solid #0d1b34;
        padding: 10px 14px;
        margin-bottom: 16px;
        font-size: 8.5pt;
        color: #444;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .info-block strong { color: #0d1b34; }

      ${styles}
    </style>
  </head>
  <body>
    ${content}
    <div class="page-footer-bar"></div>
  </body>
</html>`;
}
