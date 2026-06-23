function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildBaseHtml({
  content,
  styles = "",
  title,
}: {
  title: string;
  content: string;
  styles?: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
      }

      body {
        color: #1a1a1a;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.45;
      }

      table {
        border-collapse: collapse;
        margin: 12px 0 18px;
        width: 100%;
      }

      th,
      td {
        border: 1px solid #ccc;
      }

      th {
        background: #f0f0f0;
        font-weight: 700;
        padding: 6px 8px;
        text-align: left;
      }

      td {
        padding: 5px 8px;
        vertical-align: top;
      }

      h1 {
        font-size: 16pt;
        line-height: 1.2;
        margin: 0 0 4px;
      }

      h2 {
        font-size: 13pt;
        line-height: 1.25;
        margin: 0 0 4px;
      }

      p {
        margin: 0 0 10px;
      }

      .page-break {
        page-break-after: always;
      }

      .no-break {
        page-break-inside: avoid;
      }

      .label {
        color: #666;
        font-size: 9pt;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .amount {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      .total-row td {
        border-top: 2px solid #333;
        font-weight: 700;
      }

      .header-block {
        display: flex;
        justify-content: space-between;
        margin-bottom: 24px;
      }

      .company-name {
        color: #0d1b34;
        font-size: 18pt;
        font-weight: 700;
      }

      ${styles}
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`;
}
