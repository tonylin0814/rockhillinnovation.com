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
