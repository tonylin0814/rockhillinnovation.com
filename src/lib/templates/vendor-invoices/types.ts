export interface VendorBanking {
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  bankAddress: string | null;
  swiftCode: string | null;
  abaRouting: string | null;
  currency: string | null;
  bankingInstructions: string | null;
}

export interface VendorOutgoingInvoiceLine {
  description: string;
  amountUsd: number;
}

export interface VendorOutgoingInvoiceParams {
  invoiceNumber: string | null;
  invoiceDate: string;
  vendorCode: string;
  vendorName: string;
  vendorAddress: string | null;
  vendorBanking: VendorBanking | null;
  billToName: string;
  billToAddress: string | null;
  lines: VendorOutgoingInvoiceLine[];
  totalUsd: number;
  notes: string | null;
}
