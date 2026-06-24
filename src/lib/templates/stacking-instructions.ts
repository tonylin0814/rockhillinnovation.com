import { buildBaseHtml } from "@/lib/templates/base";
import type { CompanySettings, TradePackingPlan } from "@/types";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const COLORS = ["#dbeafe", "#dcfce7", "#fef9c3", "#fce7f3", "#ede9fe", "#ffedd5"];

export function buildStackingInstructionsHtml(plan: TradePackingPlan, companyInfo: CompanySettings | null): string {
  const sections = plan.pallets
    .map((pallet) => {
      const groups = new Map<string, typeof pallet.cases>();
      for (const item of pallet.cases) {
        groups.set(item.product_id, [...(groups.get(item.product_id) ?? []), item]);
      }
      const rows = Array.from(groups.entries())
        .sort(([, a], [, b]) => Number(b[0]?.weight_kg ?? 0) - Number(a[0]?.weight_kg ?? 0))
        .map(([productId, cases], index) => {
          const first = cases[0];
          const label = index === 0 ? "Layer 1 (Bottom)" : `Layer ${index + 1}`;
          const color = COLORS[index % COLORS.length];
          return `
            <tr style="background:${color};">
              <td>${label}</td>
              <td>${esc(first.product_code)}</td>
              <td>${esc(first.product_name)}</td>
              <td class="amount">${cases.length}</td>
              <td class="amount">${Number(first.weight_kg).toFixed(3)}</td>
              <td class="amount">${cases.reduce((sum, item) => sum + Number(item.weight_kg), 0).toFixed(3)}</td>
            </tr>`;
        })
        .join("");

      return `
        <div class="no-break pallet-card">
          <h2>${esc(pallet.pallet_label)}${pallet.is_mixed ? " - MIXED" : ""}</h2>
          <p><strong>${pallet.total_cases}</strong> cartons / <strong>${Number(pallet.total_weight_kg ?? 0).toFixed(2)}</strong> kg</p>
          <div class="warning">Stack heaviest layer first. Do not exceed ${Number(plan.pallet_max_weight_kg).toFixed(0)} kg per pallet.</div>
          <table class="line-items">
            <thead><tr><th>Layer</th><th>Product Code</th><th>Product Name</th><th class="amount">Cartons</th><th class="amount">Wt/Carton</th><th class="amount">Total kg</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join("");

  return buildBaseHtml({
    companyInfo,
    content: `
      <div class="doc-header">
        <div>
          <div class="company-name">${esc(companyInfo?.company_name ?? "Rock Hill Innovation")}</div>
          <div class="doc-address-line">Container ${plan.container_type.toUpperCase()}</div>
        </div>
        <div class="doc-type-badge">STACKING</div>
      </div>
      ${sections}
    `,
    styles: `
      .company-name { font-size: 18pt; font-weight: 800; color: #0d1b34; }
      .pallet-card { border: 1px solid #cbd5e1; padding: 14px; margin-bottom: 16px; border-radius: 8px; }
      .pallet-card h2 { margin: 0 0 4px; color: #0d1b34; }
      .warning { background: #fef2f2; border: 1px solid #fca5a5; padding: 8px; margin: 10px 0; font-size: 8.5pt; }
    `,
    title: "Stacking Instructions",
  });
}
