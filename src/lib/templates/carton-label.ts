import { buildBaseHtml } from "@/lib/templates/base";
import type { Product } from "@/types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function valueOrDash(value: string | number | null | undefined) {
  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }

  return String(value);
}

export function buildCartonLabelHtml({ product, totalCartons }: { product: Product; totalCartons: number }) {
  const cartonSize =
    product.carton_length_cm && product.carton_width_cm && product.carton_height_cm
      ? `${product.carton_length_cm} x ${product.carton_width_cm} x ${product.carton_height_cm} cm`
      : "-";

  return buildBaseHtml({
    title: `Carton Label - ${product.code}`,
    styles: `
      @page { size: 210mm 148mm; margin: 0; }
      body { padding: 0; font-size: 12pt; }
      .page-footer-bar, .page-footer-contact { display: none; }
      .label-sheet { padding: 16mm; height: 148mm; width: 210mm; border: 4px solid #0d1b34; }
      .label-header { display: flex; justify-content: space-between; border-bottom: 3px solid #0d1b34; padding-bottom: 8mm; }
      .label-brand { color: #0d1b34; font-size: 18pt; font-weight: 800; }
      .label-code { color: #0d1b34; font-size: 26pt; font-weight: 800; margin-top: 8mm; }
      .label-name { font-size: 18pt; font-weight: 700; margin-top: 3mm; }
      .label-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 10mm; }
      .label-field { border: 1px solid #cbd5e1; padding: 4mm; }
      .label-field-title { color: #64748b; font-size: 9pt; font-weight: 700; text-transform: uppercase; }
      .label-field-value { color: #0d1b34; font-size: 15pt; font-weight: 700; margin-top: 2mm; }
      .carton-count { margin-top: 10mm; font-size: 16pt; font-weight: 800; text-align: right; }
    `,
    content: `
      <div class="label-sheet">
        <div class="label-header">
          <div>
            <div class="label-brand">Rock Hill Innovation</div>
            <div>Product Carton Label</div>
          </div>
          <div>${new Date().toISOString().slice(0, 10)}</div>
        </div>

        <div class="label-code">${escapeHtml(product.code)}</div>
        <div class="label-name">${escapeHtml(product.name_english)}</div>

        <div class="label-grid">
          <div class="label-field">
            <div class="label-field-title">Supplier Code</div>
            <div class="label-field-value">${escapeHtml(valueOrDash(product.supplier_product_code))}</div>
          </div>
          <div class="label-field">
            <div class="label-field-title">Country of Origin</div>
            <div class="label-field-value">${escapeHtml(valueOrDash(product.country_of_origin))}</div>
          </div>
          <div class="label-field">
            <div class="label-field-title">Qty / Carton</div>
            <div class="label-field-value">${escapeHtml(valueOrDash(product.qty_per_carton))}</div>
          </div>
          <div class="label-field">
            <div class="label-field-title">Carton Size</div>
            <div class="label-field-value">${escapeHtml(cartonSize)}</div>
          </div>
        </div>

        <div class="carton-count">Carton _____ of ${totalCartons}</div>
      </div>
    `,
  });
}
