export interface SupplierBanking {
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  bankAddress: string | null;
  cnapsNo: string | null;
  swiftCode: string | null;
  currency: string | null;
  bankTel: string | null;
  bankingInstructions: string | null;
}

export type SupplierInvoiceLine = {
  descriptionChinese: string | null;
  descriptionEnglish: string | null;
  paymentPct: number;
  quantity: number;
  unitPriceRmb: number;
  totalRmb: number;
  paymentCategory: "outsourced" | "produced" | "misc_expense" | "adjustment";
};

export type SupplierInvoiceParams = {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: "deposit" | "final";
  supplierCode: string | null;
  supplierName: string | null;
  supplierNameChinese: string | null;
  supplierAddress: string | null;
  supplierBanking: SupplierBanking | null;
  lines: SupplierInvoiceLine[];
  totalRmb: number;
  exchangeRate: number | null;
  totalUsd: number | null;
  notes: string | null;
};
