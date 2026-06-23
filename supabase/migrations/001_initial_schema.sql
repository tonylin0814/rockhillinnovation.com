-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- HELPER: updated_at trigger
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- TABLE: users
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null check (role in ('admin', 'manager', 'partner')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: clients
-- ============================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  country text,
  currency text not null default 'USD',
  deposit_pct numeric not null default 50,
  final_pct numeric not null default 50,
  contacts jsonb not null default '[]',
  address text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: suppliers
-- ============================================================
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  name_chinese text,
  country text,
  currency text not null default 'RMB',
  invoice_format text not null default 'image' check (invoice_format in ('image', 'excel')),
  contacts jsonb not null default '[]',
  address text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: expense_vendors
-- ============================================================
create table public.expense_vendors (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  country text,
  vendor_type text not null check (vendor_type in ('legal', 'consulting', 'maintenance', 'related_company')),
  letterhead_onedrive_url text,
  contacts jsonb not null default '[]',
  address text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: products
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_english text not null,
  name_chinese text,
  product_type text not null check (product_type in ('part', 'set')),
  supplier_id uuid references public.suppliers(id) on delete set null,
  payment_category text check (payment_category in ('outsourced', 'produced')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_updated_at before update on public.products
  for each row execute function set_updated_at();

-- ============================================================
-- TABLE: product_components
-- ============================================================
create table public.product_components (
  id uuid primary key default gen_random_uuid(),
  set_product_id uuid not null references public.products(id) on delete cascade,
  component_product_id uuid not null references public.products(id) on delete restrict,
  quantity_per_set numeric not null default 1,
  sort_order integer not null default 0,
  notes text,
  unique (set_product_id, component_product_id)
);

-- ============================================================
-- TABLE: trades
-- ============================================================
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  trade_id text unique not null,
  order_number text,
  trade_date date not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'active', 'settled', 'archived')),
  working_exchange_rate numeric,
  corporate_tax_rate numeric not null default 0.12,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trades_updated_at before update on public.trades
  for each row execute function set_updated_at();
create index on public.trades(client_id);
create index on public.trades(status);

-- ============================================================
-- TABLE: trade_participants
-- ============================================================
create table public.trade_participants (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references public.users(id) on delete set null,
  unique (trade_id, user_id)
);
create index on public.trade_participants(user_id);

-- ============================================================
-- TABLE: trade_shareholders
-- ============================================================
create table public.trade_shareholders (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  person_name text not null,
  split_pct numeric not null,
  invoices_through_entity boolean not null default false,
  expense_vendor_id uuid references public.expense_vendors(id) on delete set null
);
create index on public.trade_shareholders(trade_id);

-- ============================================================
-- TABLE: trade_documents (defined before quote sessions â€” referenced by FK)
-- ============================================================
create table public.trade_documents (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  document_category text not null check (document_category in ('design', 'shipping', 'supplier_quote', 'client_quotation', 'invoice', 'approval', 'other')),
  document_type text,
  file_name text not null,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'sent_to_printer', 'archived')),
  related_party text check (related_party in ('client', 'supplier', 'internal')),
  onedrive_url text,
  onedrive_file_id text,
  file_size_bytes bigint,
  uploaded_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.trade_documents(trade_id);
create index on public.trade_documents(document_category);

-- ============================================================
-- TABLE: supplier_quote_sessions
-- ============================================================
create table public.supplier_quote_sessions (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  session_number integer not null,
  quote_date date not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'superseded')),
  source_document_id uuid references public.trade_documents(id) on delete set null,
  recorded_by text not null default 'manual' check (recorded_by in ('chatgpt', 'judy', 'manual')),
  notes text,
  created_at timestamptz not null default now(),
  unique (trade_id, session_number)
);
create index on public.supplier_quote_sessions(trade_id);

-- ============================================================
-- TABLE: supplier_quote_lines
-- ============================================================
create table public.supplier_quote_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.supplier_quote_sessions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  item_name_chinese text,
  item_name_english text,
  quantity numeric not null,
  unit_price_rmb numeric not null,
  total_price_rmb numeric generated always as (quantity * unit_price_rmb) stored,
  payment_category text check (payment_category in ('outsourced', 'produced', 'misc_expense')),
  notes text,
  sort_order integer not null default 0
);
create index on public.supplier_quote_lines(session_id);

-- ============================================================
-- TABLE: client_quotation_sessions
-- ============================================================
create table public.client_quotation_sessions (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  session_number integer not null,
  quote_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  unique (trade_id, session_number)
);
create index on public.client_quotation_sessions(trade_id);

-- ============================================================
-- TABLE: client_quotation_lines
-- ============================================================
create table public.client_quotation_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.client_quotation_sessions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  item_description text,
  quantity numeric not null,
  unit_price_usd numeric not null,
  total_price_usd numeric generated always as (quantity * unit_price_usd) stored,
  notes text
);

-- ============================================================
-- TABLE: order_lines
-- ============================================================
create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  original_item_name text,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric not null,
  unit_price_usd numeric not null,
  total_price_usd numeric generated always as (quantity * unit_price_usd) stored,
  notes text,
  sort_order integer not null default 0
);
create index on public.order_lines(trade_id);

-- ============================================================
-- TABLE: component_demand
-- ============================================================
create table public.component_demand (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  required_quantity numeric not null,
  source_order_line_ids jsonb not null default '[]',
  source_quote_line_id uuid references public.supplier_quote_lines(id) on delete set null,
  latest_unit_cost_rmb numeric,
  estimated_cost_rmb numeric,
  estimated_cost_usd numeric,
  actual_cost_usd numeric,
  notes text,
  unique (trade_id, product_id)
);
create index on public.component_demand(trade_id);

-- ============================================================
-- TABLE: exchange_rates
-- ============================================================
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  payment_type text not null check (payment_type in ('deposit', 'final')),
  rate_rmb_per_usd numeric not null,
  rate_date date not null,
  reference_rate numeric,
  notes text,
  created_at timestamptz not null default now(),
  unique (trade_id, payment_type)
);
create index on public.exchange_rates(trade_id);

-- ============================================================
-- TABLE: client_invoices
-- ============================================================
create table public.client_invoices (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  invoice_number text unique not null,
  invoice_type text not null check (invoice_type in ('pro_forma', 'deposit', 'final')),
  invoice_date date not null,
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  subtotal_usd numeric not null,
  total_usd numeric not null,
  pdf_onedrive_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.client_invoices(trade_id);

-- ============================================================
-- TABLE: client_invoice_lines
-- ============================================================
create table public.client_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.client_invoices(id) on delete cascade,
  order_line_id uuid references public.order_lines(id) on delete set null,
  description text,
  quantity numeric not null,
  unit_price_usd numeric not null,
  total_usd numeric generated always as (quantity * unit_price_usd) stored,
  sort_order integer not null default 0
);

-- ============================================================
-- TABLE: supplier_invoices_outgoing
-- ============================================================
create table public.supplier_invoices_outgoing (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  invoice_number text unique not null,
  invoice_type text not null check (invoice_type in ('deposit', 'final')),
  invoice_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  total_rmb numeric not null,
  exchange_rate_id uuid references public.exchange_rates(id) on delete set null,
  total_usd numeric,
  pdf_onedrive_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.supplier_invoices_outgoing(trade_id);

-- ============================================================
-- TABLE: supplier_invoice_outgoing_lines
-- ============================================================
create table public.supplier_invoice_outgoing_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.supplier_invoices_outgoing(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description_chinese text,
  description_english text,
  quantity numeric not null,
  unit_price_rmb numeric not null,
  total_rmb numeric generated always as (quantity * unit_price_rmb) stored,
  payment_category text not null check (payment_category in ('outsourced', 'produced', 'misc_expense')),
  source_quote_line_id uuid references public.supplier_quote_lines(id) on delete set null,
  sort_order integer not null default 0
);

-- ============================================================
-- TABLE: supplier_invoices_incoming
-- ============================================================
create table public.supplier_invoices_incoming (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  their_invoice_number text,
  invoice_date date,
  invoice_type text check (invoice_type in ('deposit', 'final')),
  file_format text check (file_format in ('image', 'excel')),
  onedrive_url text,
  total_rmb numeric,
  status text not null default 'received' check (status in ('received', 'reviewed', 'matched', 'discrepancy')),
  discrepancy_notes text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.supplier_invoices_incoming(trade_id);

-- ============================================================
-- TABLE: expense_vendor_invoices
-- ============================================================
create table public.expense_vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.expense_vendors(id) on delete restrict,
  trade_id uuid references public.trades(id) on delete set null,
  invoice_number text,
  invoice_date date not null,
  amount_usd numeric not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  trade_shareholder_id uuid references public.trade_shareholders(id) on delete set null,
  pdf_onedrive_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.expense_vendor_invoices(trade_id);
create index on public.expense_vendor_invoices(vendor_id);

-- ============================================================
-- TABLE: trade_ledger
-- ============================================================
create table public.trade_ledger (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  entry_date date not null,
  entry_type text not null check (entry_type in ('client_payment_received', 'supplier_payment_sent', 'expense_vendor_payment', 'bank_fee', 'reimbursement', 'misc')),
  direction text not null check (direction in ('in', 'out')),
  amount_usd numeric,
  amount_rmb numeric,
  exchange_rate_id uuid references public.exchange_rates(id) on delete set null,
  reference_number text,
  bank_fee_usd numeric not null default 0,
  client_invoice_id uuid references public.client_invoices(id) on delete set null,
  supplier_invoice_id uuid references public.supplier_invoices_outgoing(id) on delete set null,
  expense_vendor_invoice_id uuid references public.expense_vendor_invoices(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  recorded_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger trade_ledger_updated_at before update on public.trade_ledger
  for each row execute function set_updated_at();
create index on public.trade_ledger(trade_id);
create index on public.trade_ledger(entry_type);

-- ============================================================
-- TABLE: shareholder_book
-- ============================================================
create table public.shareholder_book (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid unique not null references public.trades(id) on delete cascade,
  gross_profit_usd numeric not null,
  expense_deductions_usd numeric not null default 0,
  taxable_base_usd numeric not null,
  corporate_tax_rate numeric not null,
  corporate_tax_usd numeric not null,
  net_profit_usd numeric not null,
  per_share_usd numeric not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  calculated_at timestamptz not null default now(),
  notes text
);

-- ============================================================
-- TABLE: shareholder_book_lines
-- ============================================================
create table public.shareholder_book_lines (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.shareholder_book(id) on delete cascade,
  trade_shareholder_id uuid references public.trade_shareholders(id) on delete set null,
  person_name text not null,
  split_pct numeric not null,
  gross_share_usd numeric not null,
  tax_contribution_usd numeric not null,
  net_share_usd numeric not null,
  invoiced_through text
);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

-- Helper function: get current user's role from public.users
create or replace function public.get_my_role()
returns text language sql stable security definer as $$
  select role from public.users where id = auth.uid()
$$;

-- Helper function: get trades accessible to current user
create or replace function public.my_trade_ids()
returns setof uuid language sql stable security definer as $$
  select trade_id from public.trade_participants where user_id = auth.uid()
$$;

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.suppliers enable row level security;
alter table public.expense_vendors enable row level security;
alter table public.products enable row level security;
alter table public.product_components enable row level security;
alter table public.trades enable row level security;
alter table public.trade_participants enable row level security;
alter table public.trade_shareholders enable row level security;
alter table public.trade_documents enable row level security;
alter table public.supplier_quote_sessions enable row level security;
alter table public.supplier_quote_lines enable row level security;
alter table public.client_quotation_sessions enable row level security;
alter table public.client_quotation_lines enable row level security;
alter table public.order_lines enable row level security;
alter table public.component_demand enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.client_invoices enable row level security;
alter table public.client_invoice_lines enable row level security;
alter table public.supplier_invoices_outgoing enable row level security;
alter table public.supplier_invoice_outgoing_lines enable row level security;
alter table public.supplier_invoices_incoming enable row level security;
alter table public.expense_vendor_invoices enable row level security;
alter table public.trade_ledger enable row level security;
alter table public.shareholder_book enable row level security;
alter table public.shareholder_book_lines enable row level security;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- USERS table
create policy "admin_all_users" on public.users for all using (get_my_role() = 'admin');
create policy "manager_read_users" on public.users for select using (get_my_role() = 'manager');
create policy "partner_read_users" on public.users for select using (get_my_role() = 'partner');

-- REFERENCE TABLES (clients, suppliers, expense_vendors, products, product_components)
-- Admin/Manager: full access. Partner: read only.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['clients','suppliers','expense_vendors','products','product_components']
  loop
    execute format('create policy "admin_manager_all_%s" on public.%s for all using (get_my_role() in (''admin'',''manager''))', tbl, tbl);
    execute format('create policy "partner_read_%s" on public.%s for select using (get_my_role() = ''partner'')', tbl, tbl);
  end loop;
end $$;

-- TRADES
create policy "admin_manager_all_trades" on public.trades for all using (get_my_role() in ('admin','manager'));
create policy "partner_trades" on public.trades for select using (
  get_my_role() = 'partner' and id in (select my_trade_ids())
);

-- TRADE_PARTICIPANTS
create policy "admin_manager_all_tp" on public.trade_participants for all using (get_my_role() in ('admin','manager'));
create policy "partner_read_tp" on public.trade_participants for select using (
  get_my_role() = 'partner' and trade_id in (select my_trade_ids())
);

-- Trade-scoped tables (all follow same pattern: admin/manager full, partner select own trades)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'trade_shareholders','trade_documents','supplier_quote_sessions',
    'client_quotation_sessions','order_lines','component_demand',
    'exchange_rates','client_invoices','supplier_invoices_outgoing',
    'supplier_invoices_incoming','expense_vendor_invoices','trade_ledger',
    'shareholder_book'
  ]
  loop
    execute format('create policy "admin_manager_all_%s" on public.%s for all using (get_my_role() in (''admin'',''manager''))', tbl, tbl);
    execute format('create policy "partner_select_%s" on public.%s for select using (get_my_role() = ''partner'' and trade_id in (select my_trade_ids()))', tbl, tbl);
  end loop;
end $$;

-- Line item tables (no trade_id â€” accessed via parent join; admin/manager full, partners read via parent)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'supplier_quote_lines','client_quotation_lines',
    'client_invoice_lines','supplier_invoice_outgoing_lines','shareholder_book_lines'
  ]
  loop
    execute format('create policy "admin_manager_all_%s" on public.%s for all using (get_my_role() in (''admin'',''manager''))', tbl, tbl);
    execute format('create policy "partner_read_%s" on public.%s for select using (get_my_role() = ''partner'')', tbl, tbl);
  end loop;
end $$;
