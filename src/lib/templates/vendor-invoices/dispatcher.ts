import { buildChenlawInvoiceHtml } from "@/lib/templates/vendor-invoices/chenlaw";
import { buildLmInvoiceHtml } from "@/lib/templates/vendor-invoices/lm";
import { buildRhInvoiceHtml } from "@/lib/templates/vendor-invoices/rh";
import { buildSgracoInvoiceHtml } from "@/lib/templates/vendor-invoices/sgraco";
import type { VendorOutgoingInvoiceParams } from "@/lib/templates/vendor-invoices/types";

const VENDOR_TEMPLATES: Record<string, (params: VendorOutgoingInvoiceParams) => string> = {
  CHENLAW: buildChenlawInvoiceHtml,
  LM: buildLmInvoiceHtml,
  RH: buildRhInvoiceHtml,
  SGRACO: buildSgracoInvoiceHtml,
};

export function buildVendorOutgoingInvoiceHtml(params: VendorOutgoingInvoiceParams): string {
  const code = params.vendorCode.toUpperCase();
  const builder = VENDOR_TEMPLATES[code];

  if (!builder) {
    throw new Error(`No template registered for vendor code: ${code}`);
  }

  return builder(params);
}
