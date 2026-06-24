import { buildBaseHtml } from "@/lib/templates/base";
import type { CartonInput, PalletCalculation, PalletInput } from "@/lib/pallet-calculator";
import type { CompanySettings } from "@/types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value: number, suffix = "") {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}${suffix}`;
}

export function buildPalletCalculationHtml({
  calculation,
  carton,
  companyInfo = null,
  containerPallets,
  pallet,
  productName,
  sideViewSvg,
  topViewSvg,
}: {
  productName: string;
  carton: CartonInput;
  pallet: PalletInput;
  calculation: PalletCalculation;
  topViewSvg: string;
  sideViewSvg: string;
  containerPallets?: number | null;
  companyInfo?: CompanySettings | null;
}) {
  const containerItems = containerPallets ? containerPallets * calculation.itemsPerPallet : null;

  return buildBaseHtml({
    companyInfo,
    title: "Pallet Calculator",
    styles: `
      .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
      .summary-card { border: 1px solid #d8dee8; border-radius: 8px; padding: 10px; background: #f8fafc; }
      .summary-card .value { color: #0d1b34; font-size: 18pt; font-weight: 700; }
      .info-table { width: 100%; border-collapse: collapse; margin-top: 14px; }
      .info-table th, .info-table td { border: 1px solid #d8dee8; padding: 7px 9px; text-align: left; }
      .info-table th { background: #eef2f7; color: #334155; font-size: 8.5pt; text-transform: uppercase; }
      .diagram { margin-top: 18px; page-break-inside: avoid; }
      .diagram svg { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
    `,
    content: `
      <div class="doc-header">
        <div>
          <div class="company-name">Rock Hill Innovation</div>
          <div class="doc-address-line">Pallet Loading Calculation</div>
        </div>
        <div class="doc-type-badge">PALLET</div>
      </div>

      <h1>${escapeHtml(productName || "Product")}</h1>
      <p class="label">Calculation Summary</p>
      <div class="summary-grid">
        <div class="summary-card"><div class="label">Cartons / Layer</div><div class="value">${calculation.cartonsPerLayer}</div></div>
        <div class="summary-card"><div class="label">Layers</div><div class="value">${calculation.layers}</div></div>
        <div class="summary-card"><div class="label">Cartons / Pallet</div><div class="value">${calculation.cartonsPerPallet}</div></div>
        <div class="summary-card"><div class="label">Items / Pallet</div><div class="value">${calculation.itemsPerPallet}</div></div>
      </div>

      <table class="info-table">
        <tbody>
          <tr><th>Carton</th><td>${formatNumber(carton.lengthCm, " L")} x ${formatNumber(
            carton.widthCm,
            " W"
          )} x ${formatNumber(carton.heightCm, " H")} cm, ${formatNumber(carton.weightKg, " kg")}</td></tr>
          <tr><th>Pallet</th><td>${formatNumber(pallet.lengthCm, " L")} x ${formatNumber(
            pallet.widthCm,
            " W"
          )} cm, max ${formatNumber(pallet.maxHeightCm, " cm")} / ${formatNumber(
            pallet.maxWeightKg,
            " kg"
          )}</td></tr>
          <tr><th>Best Orientation</th><td>${escapeHtml(calculation.orientation)}</td></tr>
          <tr><th>Gross Weight</th><td>${formatNumber(calculation.palletGrossWeightKg, " kg")}</td></tr>
          <tr><th>Footprint Used</th><td>${formatNumber(calculation.footprintUsedPct, "%")}</td></tr>
          <tr><th>Container Estimate</th><td>${
            containerItems
              ? `${containerPallets} pallets x ${calculation.itemsPerPallet} items = ${containerItems.toLocaleString()} items`
              : "-"
          }</td></tr>
        </tbody>
      </table>

      <div class="diagram">
        <h2>Top View</h2>
        ${topViewSvg}
      </div>
      <div class="diagram">
        <h2>Side View</h2>
        ${sideViewSvg}
      </div>
    `,
  });
}
