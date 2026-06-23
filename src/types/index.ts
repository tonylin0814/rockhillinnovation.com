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
  role: string;
  email: string;
  phone: string;
};

export type Client = {
  id: string;
  code: string;
  name: string;
  country: string | null;
  currency: string;
  deposit_pct: number;
  final_pct: number;
  contacts: Contact[];
  address: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
};

export type SupplierContact = {
  name: string;
  role: string;
  email: string;
  wechat: string;
  phone: string;
};

export type Supplier = {
  id: string;
  code: string;
  name: string;
  name_chinese: string | null;
  country: string | null;
  currency: string;
  invoice_format: "image" | "excel";
  contacts: SupplierContact[];
  address: string | null;
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
  name_english: string;
  name_chinese: string | null;
  product_type: "part" | "set";
  supplier_id: string | null;
  payment_category: "outsourced" | "produced" | null;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier?: { id: string; name: string; code: string } | null;
  components?: { id: string }[] | null;
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
  product?: { id: string; code: string; name_english: string; product_type: string } | null;
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
  expense_vendor?: { id: string; name: string; code: string } | null;
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
