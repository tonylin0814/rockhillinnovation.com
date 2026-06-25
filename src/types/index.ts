export type UserRole = "admin" | "manager" | "partner" | "user";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

export type CompanySettings = {
  id: string;
  company_name: string;
  company_name_full: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city_state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  sales_contact_name: string | null;
  sales_contact_email: string | null;
  sales_contact_phone: string | null;
  updated_at: string;
};

export type CompanyBankingAccount = {
  id: string;
  currency: string;
  label: string | null;
  bank_name: string;
  bank_branch: string | null;
  bank_address: string | null;
  account_name: string;
  account_number: string | null;
  swift_code: string | null;
  routing_number: string | null;
  iban: string | null;
  intermediary_bank: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type InvoiceAdjustmentLine = {
  description: string;
  amount_usd: number;
};

export type UserClientAccess = {
  user_id: string;
  client_id: string;
  access_level: "read" | "edit";
  granted_at: string;
  granted_by: string | null;
  client?: { id: string; code: string; name: string } | null;
};

export type TradeActivityLog = {
  id: string;
  trade_id: string | null;
  user_id: string | null;
  user_name: string;
  user_role: string;
  action: "created" | "updated" | "deleted";
  target_table: string;
  target_id: string | null;
  summary: string;
  created_at: string;
};

export type AiConfig = {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
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
  product_length_cm: number | null;
  product_width_cm: number | null;
  product_height_cm: number | null;
  product_weight_kg: number | null;
  product_art_notes: string | null;
  qty_per_carton: number | null;
  carton_height_cm: number | null;
  carton_width_cm: number | null;
  carton_length_cm: number | null;
  carton_weight_kg: number | null;
  cartons_per_pallet: number | null;
  pallet_length_cm: number | null;
  pallet_width_cm: number | null;
  pallet_height_cm: number | null;
  pallet_max_weight_kg: number | null;
  country_of_origin: string;
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
  source_document_url: string | null;
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
  previous_unit_cost_rmb: number | null;
  cost_change_rmb: number | null;
  cost_change_pct: number | null;
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
  quotation_ref: string | null;
  valid_until: string | null;
  pdf_onedrive_url: string | null;
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
  invoice_type: "pro_forma" | "deposit" | "final" | "commercial";
  invoice_date: string;
  due_date: string | null;
  status: "draft" | "sent" | "paid";
  deposit_pct: number;
  payment_terms: string | null;
  adjustment_lines: InvoiceAdjustmentLine[];
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
  adjustments?: SupplierInvoiceAdjustment[];
};

export type SupplierInvoiceAdjustment = {
  id: string;
  invoice_id: string;
  description: string;
  amount_rmb: number;
  notes: string | null;
  created_at: string;
};

export type QuotationHistory = {
  id: string;
  quote_date: string;
  trade_id: string | null;
  rock_hill_code: string;
  product_name: string;
  quantity: number;
  quoted_usd: number;
  notes: string | null;
  created_at: string;
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
  expected_amount_usd: number | null;
  proof_onedrive_url: string | null;
  proof_file_name: string | null;
  client_invoice?: { id: string; invoice_number: string } | null;
  supplier_invoice?: { id: string; invoice_number: string } | null;
  vendor_invoice?: { id: string; invoice_number: string } | null;
  recorder?: { id: string; name: string } | null;
};

export type MilestoneKey =
  | "deposit_received"
  | "deposit_sent"
  | "goods_shipped"
  | "balance_received"
  | "balance_sent";

export type TradeMilestone = {
  trade_id: string;
  milestone: MilestoneKey;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
};

export type TradeDiaryEntry = {
  id: string;
  trade_id: string;
  content: string;
  attachments: { name: string; onedrive_url: string; file_size_bytes: number }[];
  author_id: string | null;
  author_name: string;
  created_at: string;
  updated_at: string;
};

export type TradeExpense = {
  id: string;
  trade_id: string;
  description: string;
  amount_usd: number;
  expense_date: string;
  category: "bank_fee" | "reimbursement" | "shipping" | "duty" | "misc";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export type ProductQuoteHistory = {
  id: string;
  product_id: string | null;
  client_id: string | null;
  supplier_product_code: string | null;
  quoted_date: string;
  unit_price_usd: number;
  quantity: number | null;
  source: string;
  notes: string | null;
  created_at: string;
  product?: {
    id: string;
    code: string;
    supplier_product_code: string | null;
    name_english: string;
    name_chinese: string | null;
  } | null;
  client?: { id: string; code: string; name: string } | null;
};

export type DevelopmentVersionStatus =
  | "draft"
  | "sent_to_producer"
  | "sample_received"
  | "client_approved"
  | "rejected"
  | "in_correction";

export type DevelopmentCostType = "molding" | "sample" | "express_shipping" | "other";

export type TradeDevelopmentVersion = {
  id: string;
  trade_id: string;
  product_id: string | null;
  product_name_override: string | null;
  version_label: string;
  change_summary: string | null;
  file_onedrive_url: string | null;
  status: DevelopmentVersionStatus;
  notes: string | null;
  created_at: string;
  product?: { id: string; code: string; name_english: string } | null;
};

export type TradeDevelopmentCost = {
  id: string;
  trade_id: string;
  version_id: string | null;
  cost_type: DevelopmentCostType;
  description: string | null;
  amount_rmb: number | null;
  amount_cad: number | null;
  amount_usd: number | null;
  is_absorbed: boolean;
  notes: string | null;
  created_at: string;
};

export type ShareholderPayout = {
  id: string;
  trade_id: string;
  trade_shareholder_id: string | null;
  person_name: string;
  amount_usd: number;
  wire_date: string;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type ContainerType = "20ft" | "40ft" | "40hq";
export type PackingPlanStatus = "draft" | "confirmed";

export type TradePalletCase = {
  id: string;
  plan_id: string;
  pallet_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  case_number: number;
  case_label: string;
  qty_in_case: number;
  weight_kg: number;
  sort_order: number;
};

export type TradePalletRow = {
  id: string;
  plan_id: string;
  pallet_number: number;
  pallet_label: string;
  is_mixed: boolean;
  total_cases: number;
  total_weight_kg: number | null;
  notes: string | null;
  sort_order: number;
  cases: TradePalletCase[];
};

export type TradePackingPlan = {
  id: string;
  trade_id: string;
  container_type: ContainerType;
  pallet_length_cm: number;
  pallet_width_cm: number;
  pallet_height_cm: number;
  pallet_max_weight_kg: number;
  forklift_clearance_cm: number;
  status: PackingPlanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  pallets: TradePalletRow[];
};

export type TradeNotification = {
  id: string;
  user_id: string;
  trade_id: string;
  actor_id: string | null;
  actor_name: string;
  message: string;
  trade_code: string;
  is_read: boolean;
  created_at: string;
};
