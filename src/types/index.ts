export type UserRole = "admin" | "manager" | "partner";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

export type Contact = {
  name: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  phone: string;
  cell_phone: string;
};

export type Client = {
  id: string;
  code: string;
  name: string;
  dba_name: string | null;
  website: string | null;
  country: string | null;
  currency: string;
  deposit_pct: number;
  final_pct: number;
  contacts: Contact[];
  address: string | null;
  shipping_address: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_swift_code: string | null;
  bank_address: string | null;
  bank_tel: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
};

export type SupplierContact = {
  name: string;
  role: string;
  email: string;
  wechat: string;
  whatsapp: string;
  line: string;
  phone: string;
};

export type Supplier = {
  id: string;
  code: string;
  name: string;
  name_chinese: string | null;
  country: string | null;
  website: string | null;
  tel: string | null;
  currency: string;
  invoice_format: "image" | "excel" | "pdf" | "word";
  contacts: SupplierContact[];
  address: string | null;
  other_address: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_currency: string | null;
  bank_name: string | null;
  bank_address: string | null;
  bank_institution_no: string | null;
  bank_transit_no: string | null;
  bank_cnaps_no: string | null;
  bank_swift_code: string | null;
  bank_tel: string | null;
  banking_instructions: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
};

export type VendorContact = {
  name: string;
  role: string;
  email: string;
  phone: string;
};

export type ExpenseVendor = {
  id: string;
  code: string;
  name: string;
  country: string | null;
  vendor_type: "legal" | "consulting" | "maintenance" | "related_company";
  letterhead_onedrive_url: string | null;
  contacts: VendorContact[];
  address: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
};

export type Product = {
  id: string;
  code: string;
  supplier_product_code: string | null;
  name_english: string;
  name_chinese: string | null;
  product_type: "part" | "set";
  supplier_id: string | null;
  payment_category: "outsourced" | "produced" | null;
  status: "active" | "inactive";
  notes: string | null;
  packaging_required: boolean;
  has_carton: boolean;
  qty_per_carton: number | null;
  carton_height_cm: number | null;
  carton_width_cm: number | null;
  carton_length_cm: number | null;
  carton_weight_kg: number | null;
  cartons_per_pallet: number | null;
  product_images: ProductImage[];
  created_at: string;
  updated_at: string;
  supplier?: { id: string; name: string; code: string } | null;
  components?: { id: string }[] | null;
};

export type ProductImage = {
  name: string;
  file_name: string | null;
  file_id: string | null;
  url: string | null;
};

export type ProductCostHistory = {
  id: string;
  product_id: string;
  supplier_id: string | null;
  supplier_product_code: string | null;
  quoted_date: string;
  unit_cost_rmb: number;
  moq: string | null;
  quality: string | null;
  carton_box_packaging: string | null;
  source: string;
  notes: string | null;
  created_at: string;
  supplier?: { id: string; code: string; name: string } | null;
  product?: { id: string; code: string; name_english: string } | null;
};

export type ProductComponent = {
  id: string;
  set_product_id: string;
  component_product_id: string;
  quantity_per_set: number;
  sort_order: number;
  notes: string | null;
  component?: Product | null;
};

export type Trade = {
  id: string;
  trade_id: string;
  order_number: string | null;
  trade_date: string;
  client_id: string;
  status: "draft" | "active" | "settled" | "archived";
  working_exchange_rate: number | null;
  corporate_tax_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    code: string;
    currency?: string;
    deposit_pct?: number;
    final_pct?: number;
  } | null;
};

export type TradeParticipant = {
  id: string;
  trade_id: string;
  user_id: string;
  added_at: string;
  added_by: string | null;
  user?: { id: string; name: string; email: string; role: string } | null;
};

export type OrderLine = {
  id: string;
  trade_id: string;
  original_item_name: string | null;
  product_id: string | null;
  quantity: number;
  unit_price_usd: number;
  total_price_usd: number;
  notes: string | null;
  sort_order: number;
  product?: { id: string; code: string; supplier_product_code: string | null; name_english: string; product_type: string } | null;
};

export type ComponentDemand = {
  id: string;
  trade_id: string;
  product_id: string;
  required_quantity: number;
  source_order_line_ids: string[];
  source_quote_line_id: string | null;
  latest_unit_cost_rmb: number | null;
  estimated_cost_rmb: number | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
  notes: string | null;
  product?: {
    id: string;
    code: string;
    name_english: string;
    name_chinese: string | null;
    payment_category: string | null;
  } | null;
};

export type TradeShareholder = {
  id: string;
  trade_id: string;
  person_name: string;
  split_pct: number;
  invoices_through_entity: boolean;
  expense_vendor_id: string | null;
  expense_vendor?: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    letterhead_onedrive_url: string | null;
  } | null;
};

export type SupplierQuoteSession = {
  id: string;
  trade_id: string;
  session_number: number;
  quote_date: string;
  status: "draft" | "confirmed" | "superseded";
  source_document_id: string | null;
  recorded_by: "chatgpt" | "judy" | "manual";
  notes: string | null;
  created_at: string;
};

export type SupplierQuoteLine = {
  id: string;
  session_id: string;
  product_id: string | null;
  item_name_chinese: string | null;
  item_name_english: string | null;
  quantity: number;
  unit_price_rmb: number;
  unit_quote_usd: number;
  total_price_rmb: number;
  payment_category: "outsourced" | "produced" | "misc_expense" | null;
  notes: string | null;
  sort_order: number;
  product?: { id: string; code: string; supplier_product_code: string | null; name_english: string } | null;
};

export type ClientQuotationSession = {
  id: string;
  trade_id: string;
  client_id: string;
  session_number: number;
  quote_date: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  notes: string | null;
  created_at: string;
  client?: { id: string; name: string; code: string } | null;
};

export type ClientQuotationLine = {
  id: string;
  session_id: string;
  product_id: string | null;
  item_description: string | null;
  quantity: number;
  unit_price_usd: number;
  total_price_usd: number;
  notes: string | null;
  product?: { id: string; code: string; supplier_product_code: string | null; name_english: string } | null;
};

export type TradeDocument = {
  id: string;
  trade_id: string;
  document_category: "design" | "shipping" | "supplier_quote" | "client_quotation" | "invoice" | "approval" | "other";
  document_type: string | null;
  file_name: string;
  version: number;
  status: "draft" | "sent" | "approved" | "sent_to_printer" | "archived";
  related_party: "client" | "supplier" | "internal" | null;
  onedrive_url: string | null;
  onedrive_file_id: string | null;
  file_size_bytes: number | null;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
  uploader?: { id: string; name: string } | null;
};

export type ClientInvoice = {
  id: string;
  trade_id: string;
  invoice_number: string;
  invoice_type: "pro_forma" | "deposit" | "final";
  invoice_date: string;
  due_date: string | null;
  status: "draft" | "sent" | "paid";
  subtotal_usd: number;
  total_usd: number;
  pdf_onedrive_url: string | null;
  notes: string | null;
  created_at: string;
};

export type ClientInvoiceLine = {
  id: string;
  invoice_id: string;
  order_line_id: string | null;
  description: string | null;
  quantity: number;
  unit_price_usd: number;
  total_usd: number;
  sort_order: number;
};

export type ExchangeRate = {
  id: string;
  trade_id: string;
  payment_type: "deposit" | "final";
  rate_rmb_per_usd: number;
  rate_date: string;
  reference_rate: number | null;
  notes: string | null;
  created_at: string;
};

export type SupplierInvoiceOutgoing = {
  id: string;
  trade_id: string;
  invoice_number: string;
  invoice_type: "deposit" | "final";
  invoice_date: string;
  status: "draft" | "sent" | "paid";
  total_rmb: number;
  exchange_rate_id: string | null;
  total_usd: number | null;
  pdf_onedrive_url: string | null;
  notes: string | null;
  created_at: string;
  supplier_invoice_ref: string | null;
  supplier_stated_amount_rmb: number | null;
};

export type ExpenseVendorInvoice = {
  id: string;
  vendor_id: string;
  trade_id: string | null;
  invoice_number: string | null;
  invoice_date: string;
  amount_usd: number;
  description: string | null;
  status: "draft" | "sent" | "paid";
  trade_shareholder_id: string | null;
  pdf_onedrive_url: string | null;
  notes: string | null;
  created_at: string;
};

export type TradeLedgerEntry = {
  id: string;
  trade_id: string;
  entry_date: string;
  entry_type:
    | "client_payment_received"
    | "supplier_payment_sent"
    | "expense_vendor_payment"
    | "bank_fee"
    | "reimbursement"
    | "misc";
  direction: "in" | "out";
  amount_usd: number | null;
  amount_rmb: number | null;
  exchange_rate_id: string | null;
  reference_number: string | null;
  bank_fee_usd: number;
  client_invoice_id: string | null;
  supplier_invoice_id: string | null;
  expense_vendor_invoice_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  recorded_by: string | null;
  client_invoice?: { id: string; invoice_number: string } | null;
  supplier_invoice?: { id: string; invoice_number: string } | null;
  vendor_invoice?: { id: string; invoice_number: string } | null;
  recorder?: { id: string; name: string } | null;
};

export type ShareholderBook = {
  id: string;
  trade_id: string;
  gross_profit_usd: number;
  expense_deductions_usd: number;
  taxable_base_usd: number;
  corporate_tax_rate: number;
  corporate_tax_usd: number;
  net_profit_usd: number;
  per_share_usd: number;
  status: "draft" | "confirmed";
  calculated_at: string;
  notes: string | null;
  lines?: ShareholderBookLine[];
};

export type ShareholderBookLine = {
  id: string;
  book_id: string;
  trade_shareholder_id: string | null;
  person_name: string;
  split_pct: number;
  gross_share_usd: number;
  tax_contribution_usd: number;
  net_share_usd: number;
  invoiced_through: string | null;
};
