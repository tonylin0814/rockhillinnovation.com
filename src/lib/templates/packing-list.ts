import { buildBaseHtml } from "@/lib/templates/base";
import type { CompanySettings, TradePackingPlan } from "@/types";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildPackingListHtml(
  plan: TradePackingPlan,
  tradeRef: string,
  clientName: string,
  companyInfo: CompanySettings | null
): string {
  const totalCases = plan.pallets.reduce((sum, pallet) => sum + pallet.total_cases, 0);
  const totalWeight = plan.pallets.reduce((sum, pallet) => sum + Number(pallet.total_weight_kg ?? 0), 0);
  const rows = plan.pallets
    .map((pallet) => {
      const caseRows = pallet.cases
        .map(
          (item) => `
          <tr>
            <td>${esc(pallet.pallet_label)}</td>
            <td class="item-code">${esc(item.case_label)}</td>
            <td>${esc(item.product_code)}</td>
            <td>${esc(item.product_name)}</td>
            <td class="amount">${item.qty_in_case}</td>
            <td class="amount">1</td>
            <td class="amount">${Number(item.weight_kg).toFixed(3)}</td>
          </tr>`
        )
        .join("");

      return `
        <tr class="pallet-row">
          <td colspan="7">
            ${esc(pallet.pallet_label)}${pallet.is_mixed ? " - Mixed Pallet" : ""}
            <span>${pallet.total_cases} cases / ${Number(pallet.total_weight_kg ?? 0).toFixed(2)} kg</span>
          </td>
        </tr>
        ${caseRows}`;
    })
    .join("");

  return buildBaseHtml({
    companyInfo,
    content: `
      <div class="doc-header">
        <div>
          <div class="company-name">${esc(companyInfo?.company_name ?? "Rock Hill Innovation")}</div>
          <div class="doc-address-line">Trade ${esc(tradeRef)} / Client ${esc(clientName)}</div>
        </div>
        <div class="doc-type-badge">PACKING LIST</div>
      </div>
      <table class="doc-meta-table">
        <tr><td class="doc-meta-label">Container</td><td class="doc-meta-value-bold">${plan.container_type.toUpperCase()}</td></tr>
        <tr><td class="doc-meta-label">Pallets</td><td class="doc-meta-value-bold">${plan.pallets.length}</td></tr>
        <tr><td class="doc-meta-label">Status</td><td class="doc-meta-value-bold">${plan.status.toUpperCase()}</td></tr>
      </table>
      <table class="line-items">
        <thead>
          <tr>
            <th>Pallet</th><th>Case</th><th>Product Code</th><th>Description</th>
            <th class="amount">Qty</th><th class="amount">Cartons</th><th class="amount">G.W. kg</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row"><td colspan="5">TOTAL</td><td class="amount">${totalCases}</td><td class="amount">${totalWeight.toFixed(2)}</td></tr>
        </tbody>
      </table>
    `,
    styles: `
      .company-name { font-size: 18pt; font-weight: 800; color: #0d1b34; }
      .pallet-row td { background: #eef2f7 !important; color: #0d1b34; font-weight: 800; }
      .pallet-row span { color: #64748b; font-weight: 500; margin-left: 12px; }
    `,
    title: `Packing List - ${tradeRef}`,
  });
}
