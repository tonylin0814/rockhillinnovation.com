# Rock Hill Innovation — Supabase Schema Design

All tables live in Supabase (PostgreSQL). Row-Level Security (RLS) is enforced at the database level so access rules cannot be bypassed through the API.

---

## Access Control Summary

| Role | Supabase Role Tag | What they see |
|---|---|---|
| Admin (Tony) | `admin` | All rows in all tables |
| Manager (Michael) | `manager` | All rows except `users` management |
| Project Partner (Amish, etc.) | `partner` | Only trades listed in `trade_participants` for their user_id |

RLS policies are applied per table. Partners are blocked at the DB level — invisible trades return zero rows, not an error.

---

## Table Definitions

---

### `users`
Extends Supabase Auth. One row per account.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. Matches Supabase Auth user id. |
| email | text | Unique. Used for login. |
| name | text | Display name. |
| role | text | `admin` / `manager` / `partner` |
| is_active | boolean | Admin can deactivate accounts without deleting. |
| created_at | timestamptz | |

---

### `clients`
One row per client company.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| code | text | Short code. e.g. `MLP`, `VM`, `REIST`. Unique. |
| name | text | Full company name. |
| country | text | e.g. `Canada` |
| currency | text | Always `USD` for now. |
| deposit_pct | numeric | e.g. `50` for 50% deposit. |
| final_pct | numeric | e.g. `50` for 50% final. |
| contacts | jsonb | Array of `{name, role, email, phone}` objects. |
| address | text | |
| notes | text | |
| status | text | `active` / `inactive` |
| created_at | timestamptz | |

---

### `suppliers`
One row per supplier.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| code | text | e.g. `GZ-JICAI`. Unique. |
| name | text | English name. |
| name_chinese | text | Chinese name. |
| country | text | e.g. `China` |
| currency | text | Always `RMB` for now. |
| invoice_format | text | `image` / `excel` — how they send invoices. |
| contacts | jsonb | Array of `{name, role, email, wechat, phone}` objects. |
| address | text | |
| notes | text | |
| status | text | `active` / `inactive` |
| created_at | timestamptz | |

---

### `expense_vendors`
Chenlaw, RH Services, Sgraco, LM Consulting, Rock Hill Co. Rock Hill generates invoices on their behalf.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| code | text | e.g. `CHENLAW`, `SGRACO`. Unique. |
| name | text | Full legal name. |
| country | text | |
| vendor_type | text | `legal` / `consulting` / `maintenance` / `related_company` |
| letterhead_onedrive_url | text | OneDrive link to their letterhead template. |
| contacts | jsonb | |
| address | text | |
| notes | text | |
| status | text | `active` / `inactive` |
| created_at | timestamptz | |

---

### `products`
Master catalog. Every component and every sellable item.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| code | text | e.g. `P-Set`, `P-Single`, `A-Cup`. Unique. |
| name_english | text | |
| name_chinese | text | |
| product_type | text | `part` / `set` |
| supplier_id | uuid | FK → `suppliers`. Which supplier makes/provides this. |
| payment_category | text | `outsourced` / `produced`. Determines deposit vs. final split for supplier invoices. Only relevant for parts. |
| status | text | `active` / `inactive` |
| notes | text | |
| created_at | timestamptz | |

---

### `product_components`
Defines what parts make up a set. Only applies to products where `product_type = 'set'`.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| set_product_id | uuid | FK → `products` (the set). |
| component_product_id | uuid | FK → `products` (the part). |
| quantity_per_set | numeric | How many of this part per one set unit. |
| sort_order | integer | Display order in UI. |
| notes | text | |

---

### `trades`
One row per trade/order. The central record everything else links to.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | text | Human-readable ID. e.g. `MLP-2026-06-02`. Unique. |
| order_number | text | Client order number. e.g. `MLP-042826`. |
| trade_date | date | |
| client_id | uuid | FK → `clients`. |
| status | text | `draft` / `active` / `settled` / `archived` |
| working_exchange_rate | numeric | RMB per USD. Estimate used during order phase. |
| corporate_tax_rate | numeric | Default `0.12`. Overridable per trade. |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `trade_participants`
Controls which Project Partners can see a trade. RLS reads this table.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| user_id | uuid | FK → `users`. |
| added_at | timestamptz | |
| added_by | uuid | FK → `users`. Who granted access. |

---

### `trade_shareholders`
Per-trade profit split rules.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| person_name | text | e.g. `Tony Lin`, `Michael Lin`, `Amish Patel`. |
| split_pct | numeric | e.g. `33.3333` |
| invoices_through_entity | boolean | If true, this person's share is treated as a pre-tax business expense (invoiced via Sgraco/LM). |
| expense_vendor_id | uuid | FK → `expense_vendors`. Which vendor they invoice through. Nullable. |

---

### `supplier_quote_sessions`
One session = one round of quotes from the supplier for a trade. A trade can have many sessions.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| session_number | integer | Revision round. 1 = first quote, 2 = first revision, etc. |
| quote_date | date | |
| status | text | `draft` / `confirmed` / `superseded` |
| source_document_id | uuid | FK → `trade_documents`. The original quote image or file — stored in the unified document library. |
| recorded_by | text | `chatgpt` / `judy` / `manual` |
| notes | text | |
| created_at | timestamptz | |

---

### `supplier_quote_lines`
Individual line items within a quote session.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| session_id | uuid | FK → `supplier_quote_sessions`. |
| product_id | uuid | FK → `products`. Nullable if unmatched. |
| item_name_chinese | text | As quoted by supplier. |
| item_name_english | text | |
| quantity | numeric | Quoted quantity. |
| unit_price_rmb | numeric | |
| total_price_rmb | numeric | Calculated: unit × qty. |
| payment_category | text | `outsourced` / `produced` / `misc_expense`. Overrides product default if set. |
| notes | text | |
| sort_order | integer | |

---

### `client_quotation_sessions`
One session = one round of outgoing quotes sent to a client.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| client_id | uuid | FK → `clients`. |
| session_number | integer | Revision round. |
| quote_date | date | |
| status | text | `draft` / `sent` / `accepted` / `rejected` |
| notes | text | |
| created_at | timestamptz | |

---

### `client_quotation_lines`
Individual line items in a client quotation.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| session_id | uuid | FK → `client_quotation_sessions`. |
| product_id | uuid | FK → `products`. |
| item_description | text | Client-facing description. |
| quantity | numeric | |
| unit_price_usd | numeric | |
| total_price_usd | numeric | Calculated. |
| notes | text | |

---

### `order_lines`
Confirmed order — what the client actually ordered. Locked in when order is confirmed.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| original_item_name | text | Client's original item label. |
| product_id | uuid | FK → `products`. Matched standard product. |
| quantity | numeric | |
| unit_price_usd | numeric | Confirmed sale price. |
| total_price_usd | numeric | Calculated. |
| notes | text | |
| sort_order | integer | |

---

### `component_demand`
Expanded component requirements derived from order lines + product catalog. Recalculated when order lines change.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| product_id | uuid | FK → `products` (the component/part). |
| required_quantity | numeric | Total qty needed across all order lines. |
| source_order_line_ids | jsonb | Array of order_line ids that generated this demand. |
| source_quote_line_id | uuid | FK → `supplier_quote_lines`. The exact quote line this cost was pulled from. Preserves cost traceability even if quotes are later revised. |
| latest_unit_cost_rmb | numeric | From latest confirmed supplier quote. |
| estimated_cost_rmb | numeric | unit × qty. |
| estimated_cost_usd | numeric | Using working exchange rate from trades. |
| actual_cost_usd | numeric | Populated after payments settled using locked exchange rate. |
| notes | text | |

---

### `exchange_rates`
One row per locked payment rate. Manually entered, with a reference rate stored alongside.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| payment_type | text | `deposit` / `final` |
| rate_rmb_per_usd | numeric | Manually entered agreed rate. |
| rate_date | date | Date the rate was agreed. |
| reference_rate | numeric | API-fetched reference rate at time of entry (for comparison). |
| notes | text | |
| created_at | timestamptz | |

---

### `trade_documents`
Metadata register for all files in a trade. Actual files live on OneDrive.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| document_category | text | `design` / `shipping` / `supplier_quote` / `client_quotation` / `invoice` / `approval` / `other` |
| document_type | text | e.g. `packing_list`, `bill_of_lading`, `dieline`, `print_ready`, `revision_proof`, `manifest`, `customs` |
| file_name | text | Stored file name. |
| version | integer | Version number. Starts at 1. |
| status | text | `draft` / `sent` / `approved` / `sent_to_printer` / `archived` |
| related_party | text | `client` / `supplier` / `internal` |
| onedrive_url | text | Direct link to the file. |
| onedrive_file_id | text | Microsoft Graph file ID for API operations. |
| file_size_bytes | bigint | |
| uploaded_by | uuid | FK → `users`. |
| notes | text | |
| created_at | timestamptz | |

---

### `client_invoices`
Pro-formas and invoices sent to clients.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| invoice_number | text | e.g. `MLP-042826`, `MLP-042826-D` |
| invoice_type | text | `pro_forma` / `deposit` / `final` |
| invoice_date | date | |
| due_date | date | |
| status | text | `draft` / `sent` / `paid` |
| subtotal_usd | numeric | |
| total_usd | numeric | |
| pdf_onedrive_url | text | Generated PDF stored on OneDrive. |
| notes | text | |
| created_at | timestamptz | |

---

### `client_invoice_lines`
Line items within a client invoice.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| invoice_id | uuid | FK → `client_invoices`. |
| order_line_id | uuid | FK → `order_lines`. |
| description | text | Client-facing description. |
| quantity | numeric | |
| unit_price_usd | numeric | |
| total_usd | numeric | |
| sort_order | integer | |

---

### `supplier_invoices_outgoing`
Rock Hill's own invoice sent TO the supplier (not what supplier sends).

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| invoice_number | text | e.g. `T-042826-D`, `T-042826-F` |
| invoice_type | text | `deposit` / `final` |
| invoice_date | date | |
| status | text | `draft` / `sent` / `paid` |
| total_rmb | numeric | |
| exchange_rate_id | uuid | FK → `exchange_rates`. Rate used to convert to USD. |
| total_usd | numeric | Calculated from total_rmb ÷ rate. |
| pdf_onedrive_url | text | |
| notes | text | |
| created_at | timestamptz | |

---

### `supplier_invoice_outgoing_lines`
Line items in Rock Hill's outgoing supplier invoice.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| invoice_id | uuid | FK → `supplier_invoices_outgoing`. |
| product_id | uuid | FK → `products`. Nullable for misc expenses. |
| description_chinese | text | |
| description_english | text | |
| quantity | numeric | |
| unit_price_rmb | numeric | |
| total_rmb | numeric | |
| payment_category | text | `outsourced` / `produced` / `misc_expense` |
| source_quote_line_id | uuid | FK → `supplier_quote_lines`. Traces which quote line this invoice line was generated from. |
| sort_order | integer | |

---

### `supplier_invoices_incoming`
The invoice GZ-Jicai sends to Rock Hill. Uploaded as image or Excel.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| supplier_id | uuid | FK → `suppliers`. |
| their_invoice_number | text | Supplier's own invoice number. |
| invoice_date | date | |
| invoice_type | text | `deposit` / `final` |
| file_format | text | `image` / `excel` |
| onedrive_url | text | Uploaded file on OneDrive. |
| total_rmb | numeric | As stated on their invoice. |
| status | text | `received` / `reviewed` / `matched` / `discrepancy` |
| discrepancy_notes | text | If status = discrepancy, describe what differs. |
| notes | text | |
| created_at | timestamptz | |

---

### `expense_vendor_invoices`
Invoices Rock Hill generates on behalf of expense vendors.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| vendor_id | uuid | FK → `expense_vendors`. |
| trade_id | uuid | FK → `trades`. Nullable — some expenses are not trade-specific. |
| invoice_number | text | |
| invoice_date | date | |
| amount_usd | numeric | |
| description | text | What the invoice is for. |
| status | text | `draft` / `sent` / `paid` |
| trade_shareholder_id | uuid | FK → `trade_shareholders`. Optional — populated when this expense relates to a shareholder's profit share invoicing (e.g. Amish invoicing via Sgraco). |
| pdf_onedrive_url | text | Generated PDF on OneDrive. |
| notes | text | |
| created_at | timestamptz | |

---

### `trade_ledger`
Running financial ledger for a trade. Every money movement recorded here.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. |
| entry_date | date | |
| entry_type | text | `client_payment_received` / `supplier_payment_sent` / `expense_vendor_payment` / `bank_fee` / `reimbursement` / `misc` |
| direction | text | `in` / `out` |
| amount_usd | numeric | Nullable if RMB transaction. |
| amount_rmb | numeric | Nullable if USD transaction. |
| exchange_rate_id | uuid | FK → `exchange_rates`. Nullable. |
| reference_number | text | Invoice number, payment reference, bank ref. |
| bank_fee_usd | numeric | Bank fee associated with this transaction. Default 0. |
| client_invoice_id | uuid | FK → `client_invoices`. Populated if this entry relates to a client invoice. |
| supplier_invoice_id | uuid | FK → `supplier_invoices_outgoing`. Populated if this entry relates to a supplier invoice. |
| expense_vendor_invoice_id | uuid | FK → `expense_vendor_invoices`. Populated if this entry relates to a vendor invoice. |
| notes | text | Only one of the three invoice FKs above should be populated per row. |
| created_at | timestamptz | |
| recorded_by | uuid | FK → `users`. |

---

### `shareholder_book`
Calculated profit distribution per trade. Generated when trade is settled.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| trade_id | uuid | FK → `trades`. Unique — one book per trade. |
| gross_profit_usd | numeric | Total trade profit before tax deductions. |
| expense_deductions_usd | numeric | Total paid to expense vendors (Sgraco, LM, etc.). |
| taxable_base_usd | numeric | Tony's pre-tax share (gross ÷ shareholder count). |
| corporate_tax_rate | numeric | Rate used (from trade settings). |
| corporate_tax_usd | numeric | taxable_base × rate. |
| net_profit_usd | numeric | gross_profit − corporate_tax. |
| per_share_usd | numeric | net_profit ÷ shareholder count. |
| status | text | `draft` / `confirmed` |
| calculated_at | timestamptz | |
| notes | text | |

---

### `shareholder_book_lines`
One row per shareholder per trade.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. |
| book_id | uuid | FK → `shareholder_book`. |
| trade_shareholder_id | uuid | FK → `trade_shareholders`. Links this payout line to the shareholder rule that drove it. |
| person_name | text | |
| split_pct | numeric | |
| gross_share_usd | numeric | Before tax. |
| tax_contribution_usd | numeric | Their share of the corporate tax. |
| net_share_usd | numeric | What they actually receive. |
| invoiced_through | text | Vendor name if invoices through entity. Null if direct. |

---

## Relationships Summary

```
users
  └── trade_participants → trades

trades
  ├── trade_participants → users (access control)
  ├── trade_shareholders → expense_vendors (profit split + who invoices through which entity)
  ├── order_lines → products
  ├── component_demand → products
  │     └── source_quote_line_id → supplier_quote_lines (cost traceability)
  ├── supplier_quote_sessions
  │     ├── source_document_id → trade_documents (quote image in unified library)
  │     └── supplier_quote_lines → products
  ├── client_quotation_sessions → client_quotation_lines → products
  ├── exchange_rates (one per deposit, one per final payment)
  ├── trade_documents (unified file register — all files for this trade)
  ├── client_invoices → client_invoice_lines → order_lines
  ├── supplier_invoices_outgoing
  │     ├── exchange_rate_id → exchange_rates
  │     └── supplier_invoice_outgoing_lines → products
  │           └── source_quote_line_id → supplier_quote_lines (invoice ↔ quote traceability)
  ├── supplier_invoices_incoming (their version, stored on OneDrive)
  ├── expense_vendor_invoices → expense_vendors
  │     └── trade_shareholder_id → trade_shareholders (links vendor invoice to shareholder record)
  ├── trade_ledger
  │     ├── client_invoice_id → client_invoices
  │     ├── supplier_invoice_id → supplier_invoices_outgoing
  │     ├── expense_vendor_invoice_id → expense_vendor_invoices
  │     └── exchange_rate_id → exchange_rates
  └── shareholder_book
        └── shareholder_book_lines
              └── trade_shareholder_id → trade_shareholders (payout ↔ rule traceability)

products
  └── product_components (set → parts, with qty_per_set)
```

---

## RLS Policy Rules

### Admin
- Full SELECT, INSERT, UPDATE, DELETE on all tables.

### Manager
- Full SELECT, INSERT, UPDATE, DELETE on all tables **except** `users` (read-only on users).

### Partner
- `trades`: SELECT only where `id` IN (SELECT trade_id FROM trade_participants WHERE user_id = auth.uid())
- `order_lines`, `component_demand`, `supplier_quote_sessions`, `supplier_quote_lines`, `client_quotation_sessions`, `client_quotation_lines`, `exchange_rates`, `trade_documents`, `client_invoices`, `client_invoice_lines`, `supplier_invoices_outgoing`, `supplier_invoice_outgoing_lines`, `supplier_invoices_incoming`, `expense_vendor_invoices`, `trade_ledger`, `shareholder_book`, `shareholder_book_lines`: SELECT only where `trade_id` is in their permitted trades.
- `users`, `clients`, `suppliers`, `expense_vendors`, `products`, `product_components`: SELECT only (read reference data, no edits).
- No INSERT, UPDATE, or DELETE on any table.

---

## Notes

- All `id` columns use `uuid` with `gen_random_uuid()` as default.
- All tables include `created_at timestamptz DEFAULT now()`.
- `updated_at` is added to frequently-edited tables (`trades`, `products`, `trade_ledger`) using a Supabase trigger.
- `jsonb` is used for contacts and multi-value fields to keep the schema flexible without extra join tables.
- ChatGPT writes are always inserted with a `status = 'draft'` flag so nothing is auto-confirmed.
- OneDrive file IDs (Microsoft Graph) are stored alongside URLs so files can be moved or renamed without breaking links.
