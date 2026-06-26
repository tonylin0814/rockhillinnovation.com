import { buildDefaultSupplierInvoiceHtml } from "@/lib/templates/supplier-invoices/default";
import { buildJicaiInvoiceHtml } from "@/lib/templates/supplier-invoices/jicai";
import type { SupplierInvoiceParams } from "@/lib/templates/supplier-invoices/types";

export type {
  SupplierBanking,
  SupplierInvoiceLine,
  SupplierInvoiceParams,
} from "@/lib/templates/supplier-invoices/types";

const SUPPLIER_TEMPLATES: Record<string, (params: SupplierInvoiceParams) => string> = {
  JICAI: buildJicaiInvoiceHtml,
};

export function buildSupplierInvoiceOutgoingHtml(params: SupplierInvoiceParams): string {
  const code = params.supplierCode?.toUpperCase() ?? "";
  const builder = SUPPLIER_TEMPLATES[code] ?? buildDefaultSupplierInvoiceHtml;
  return builder(params);
}
