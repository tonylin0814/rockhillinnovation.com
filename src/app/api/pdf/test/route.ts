import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { generatePdf } from "@/lib/pdf";
import { buildBaseHtml } from "@/lib/templates/base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildDummyContent() {
  const today = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date());
  const lorem =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer feugiat, justo at cursus tincidunt, urna erat luctus neque, sed luctus mi sem vitae nisl. ";
  const longText = Array.from({ length: 20 }, () => `<p>${lorem.repeat(4)}</p>`).join("");

  return `
    <div class="header-block">
      <div>
        <div class="company-name">Rock Hill Innovation</div>
        <div class="label">PDF Template Test</div>
      </div>
      <div>
        <div class="label">Date</div>
        <div>${today}</div>
      </div>
    </div>

    <h1>Sample Table</h1>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Description</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>001</td>
          <td>Design review</td>
          <td class="amount">$125.00</td>
        </tr>
        <tr>
          <td>002</td>
          <td>Supplier coordination</td>
          <td class="amount">$240.00</td>
        </tr>
        <tr>
          <td>003</td>
          <td>Document preparation</td>
          <td class="amount">$85.00</td>
        </tr>
        <tr class="total-row">
          <td colspan="2">Total</td>
          <td class="amount">$450.00</td>
        </tr>
      </tbody>
    </table>

    ${longText}

    <div class="page-break"></div>
    <h2>Page 2 Content</h2>
    <p>${lorem.repeat(8)}</p>
  `;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const html = buildBaseHtml({
    content: buildDummyContent(),
    title: "Rock Hill Innovation PDF Test",
  });
  const pdf = await generatePdf(html);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Disposition": 'inline; filename="rock-hill-pdf-test.pdf"',
      "Content-Type": "application/pdf",
    },
  });
}
