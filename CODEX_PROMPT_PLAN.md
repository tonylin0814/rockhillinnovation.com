# Rock Hill Innovation — Codex Prompt Plan

## Workflow

1. Claude writes the prompt for the current step.
2. Codex executes the work in the GitHub repo.
3. Claude inspects the output.
4. If approved, Claude writes the next prompt.
5. If issues found, Claude writes a correction prompt before moving on.

**Repo:** https://github.com/tonylin0814/rockhillinnovation.com.git  
**Domain:** www.rockhillinnovation.com  
**Email:** sales@rockhillinnovation.com  
**Stack:** Next.js + Supabase + shadcn/ui + Puppeteer + Resend + OneDrive (Microsoft Graph) + OpenAI API

---

## Phase 1 — Foundation

### Prompt 1-A: Project Initialization
Set up the Next.js project with TypeScript, Tailwind CSS, and shadcn/ui. Configure folder structure, environment variable placeholders, and base layout (sidebar + content area). No pages built yet — structure only.

**Inspect:** Folder structure, layout renders, no errors on `npm run dev`.

---

### Prompt 1-B: Supabase Schema Migration
Write the full SQL migration file covering all 28 tables with correct column types, foreign keys, indexes, and RLS policies as defined in SUPABASE_SCHEMA.md. Apply to Supabase project.

**Inspect:** All tables exist in Supabase dashboard. RLS policies are active. Foreign keys are correct.

---

### Prompt 1-C: Supabase Auth — Login & Role System
Build the login page at `/login`. No signup form — login only. On successful login, read the user's role from the `users` table and store in session context. Redirect to dashboard after login. Protect all routes: unauthenticated users are redirected to `/login`.

**Inspect:** Login works. Unauthenticated routes redirect. Role is accessible in session.

---

### Prompt 1-D: Admin — User Management
Build the user management page at `/admin/users` (Admin only). Admin can:
- Create a new account (name, email, role: admin / manager / partner).
- Deactivate / reactivate an account.
- See a list of all users with their role and status.

No self-signup exists anywhere in the app.

**Inspect:** Admin can create users. Partner and Manager roles cannot access this page (RLS + route guard).

---

### Prompt 1-E: Sidebar Navigation + Dashboard Shell
Build the left sidebar with navigation links to all modules. Links shown depend on role. Build a dashboard shell page at `/dashboard` — layout only, no data yet (data comes in Phase 7).

**Inspect:** Sidebar renders correctly. Role-based nav works. Dashboard page loads.

---

## Phase 2 — Master Data

### Prompt 2-A: Client Profiles
Build `/clients` — list of all clients with status. Build `/clients/[id]` — client detail page showing all fields (name, code, country, currency, deposit/final split %, contacts, notes). Admin and Manager can create and edit. Partners have no access to this section.

**Inspect:** CRUD works. RLS blocks partners. Contacts stored as JSON display correctly.

---

### Prompt 2-B: Supplier Profiles
Build `/suppliers` — same pattern as clients. Includes invoice format field (image / excel). Admin and Manager only.

**Inspect:** CRUD works. RLS blocks partners.

---

### Prompt 2-C: Expense Vendors
Build `/vendors` — list and detail pages for expense vendors (Chenlaw, RH Services, Sgraco, LM Consulting, Rock Hill Co.). Includes letterhead template OneDrive URL field. Admin and Manager only.

**Inspect:** CRUD works. All 5 existing vendors can be entered.

---

### Prompt 2-D: Product Catalog — Parts
Build `/products` — list of all products. Build `/products/[id]` — detail page. For parts: code, English name, Chinese name, supplier, payment category (outsourced / produced), status. Admin and Manager only.

**Inspect:** Parts can be created and edited. Payment category is selectable.

---

### Prompt 2-E: Product Catalog — Sets & Bundle Builder
Extend `/products/[id]` for set-type products. When `product_type = set`, show a component builder: add/remove/reorder components from the product list, set quantity per unit. Display the full bundle definition clearly.

**Inspect:** Sets can be built from parts. Components display in correct order. Qty per unit saves correctly.

---

## Phase 3 — Trade Management

### Prompt 3-A: Trade List & Creation
Build `/trades` — list of all trades with status, client, date, and estimated value. Partners see only their assigned trades (RLS enforced). Build trade creation form: trade ID, order number, date, client, working exchange rate, corporate tax rate. On creation, admin assigns which project partners have access.

**Inspect:** Trade list respects RLS for partners. Trade creation works. Partner assignment saves to `trade_participants`.

---

### Prompt 3-B: Trade Detail Page — Shell
Build `/trades/[id]` — the main trade workspace. Tabbed layout with tabs for: Summary, Supplier Quotes, Client Quotations, Order Lines, Documents, Invoices, Ledger, Shareholders. Tabs are shells only — content built in subsequent prompts.

**Inspect:** Trade detail loads. All tabs render without errors.

---

### Prompt 3-C: Order Lines & Component Demand
Build the Order Lines tab. User enters order lines (original item name, matched product, quantity, confirmed USD price). On save, system automatically expands sets using the product catalog and writes `component_demand` rows. Show component demand table below order lines with RMB cost (from latest confirmed supplier quote) and estimated USD cost (from trade working rate).

**Inspect:** Order lines save. Bundle expansion runs correctly. Component demand table is accurate.

---

### Prompt 3-D: Trade Shareholders
Build the Shareholders tab on the trade detail page. Admin sets which people participate in this trade, their split %, whether they invoice through an external entity, and which vendor. Corporate tax rate inheritable from trade creation but editable here.

**Inspect:** Shareholder rules save correctly. Split percentages validated to sum to 100%.

---

## Phase 4 — Supplier Quote Tracker

### Prompt 4-A: Supplier Quote Sessions
Build the Supplier Quotes tab on the trade detail page. User can create a new quote session (session number auto-increments, date, status, recorded_by, notes). Each session links to a document in the trade document library (the original quote image). Sessions list shows all rounds with status badges.

**Inspect:** Sessions create and list correctly. Status badges display.

---

### Prompt 4-B: Supplier Quote Line Items
Build the quote line item editor within a session. User can add/edit/remove lines: product (searchable dropdown from catalog), Chinese name, English name, quantity, RMB unit price (auto-calculates total), payment category. Show running total in RMB.

**Inspect:** Line items save. Totals calculate correctly. Product search works.

---

### Prompt 4-C: Quote Comparison View
Build a cost comparison view accessible from the Supplier Quotes tab. For any selected component/product, show its price history across all quote sessions and all trades. Display in a table: trade ID, session, date, RMB unit price, change vs. previous.

**Inspect:** History table shows correct data across trades. Price changes are visible.

---

## Phase 5 — Client Quotation Tracker

### Prompt 5-A: Client Quotation Sessions
Build the Client Quotations tab on the trade detail page. Same session/versioning pattern as supplier quotes but outgoing. Sessions show: round number, date, status (draft / sent / accepted / rejected).

**Inspect:** Sessions create and list correctly.

---

### Prompt 5-B: Client Quotation Line Items
Build the line item editor for client quotations: product, client-facing description, quantity, USD unit price, total. Running total in USD.

**Inspect:** Line items save. Totals correct.

---

## Phase 6 — Document Library

### Prompt 6-A: OneDrive Integration
Set up Microsoft Graph API integration. User can authenticate the app with their OneDrive account (one-time admin setup). Build the upload function: select a file → upload to OneDrive under the correct trade folder path → store metadata + OneDrive file ID in `trade_documents`.

**Inspect:** File uploads to OneDrive. Metadata saves to Supabase. File ID stored for future operations.

---

### Prompt 6-B: Trade Document Library UI
Build the Documents tab on the trade detail page. Shows all documents for this trade grouped by category (design, shipping, supplier quote, client quotation, invoice, other). Each document shows: name, version, status, date, uploaded by, and a direct OneDrive link. User can upload new files, update status, and add a new version of an existing document.

**Inspect:** Documents list correctly. Grouping works. Upload triggers OneDrive integration. Status updates save.

---

## Phase 7 — Document Generation

### Prompt 7-A: Puppeteer Setup & Base PDF Template
Install and configure Puppeteer in the Next.js API routes. Build a base HTML/CSS template system: a reusable page layout with consistent header, footer (with page numbers), and body area. Test with a dummy document. All generated PDFs save to OneDrive and register in `trade_documents`.

**Inspect:** PDF generates without errors. Header/footer appear on all pages. Page numbers correct. Saves to OneDrive.

---

### Prompt 7-B: Client Pro-Forma Invoice Generator
Build the pro-forma invoice generator using Tony's MLP template as the reference design. Recreate the layout precisely in HTML/CSS. Pull data from: trade, order lines, client profile. Generate PDF, save to OneDrive, record in `client_invoices`.

**Inspect:** PDF matches template layout exactly. Data populates correctly. Pagination consistent.

---

### Prompt 7-C: Client Deposit & Final Invoice Generator
Extend the invoice generator for deposit (50% of total, `-D` suffix) and final (remaining balance) invoices. Payment terms pulled from client profile and trade settings.

**Inspect:** Deposit and final amounts calculate correctly. Invoice numbers use correct suffixes.

---

### Prompt 7-D: Supplier Invoice Generator (Rock Hill's version)
Build Rock Hill's outgoing supplier invoice generator. Pull data from: confirmed supplier quote lines, categorized as outsourced / produced / misc expense. Deposit invoice: outsourced items at 100% + produced items at 50%. Final invoice: produced items remaining 50% + all misc expenses. Apply locked exchange rate to show USD equivalent. Generate PDF, save to OneDrive, record in `supplier_invoices_outgoing`.

**Inspect:** Deposit/final split calculates correctly by category. Exchange rate applies. PDF saves.

---

### Prompt 7-E: Expense Vendor Invoice Generator
Build the vendor invoice generator. Uses the vendor's letterhead template from OneDrive as the base. Admin fills in: amount, date, description, linked trade. Generates PDF in vendor's format, saves to OneDrive, records in `expense_vendor_invoices`.

**Inspect:** PDF uses correct letterhead per vendor. Data populates. Saves correctly.

---

## Phase 8 — Exchange Rates

### Prompt 8-A: Exchange Rate Management
Build the exchange rate panel on the trade detail page (inside the Ledger tab). User can add a rate per payment type (deposit / final): enter agreed RMB/USD rate, date, notes. On entry, system fetches a reference rate from the exchange rate API and stores it alongside. Display both rates clearly. Average rate calculated and shown at book close.

**Inspect:** Rates save correctly per payment type. Reference rate fetches from API. Average displays.

---

## Phase 9 — Bookkeeping

### Prompt 9-A: Trade Ledger
Build the Ledger tab on the trade detail page. Shows all money movements for this trade in chronological order. User can add entries: date, type, direction (in/out), USD or RMB amount, bank fee, exchange rate (if RMB), linked invoice, notes. Running balance shown. Totals: total in, total out, net.

**Inspect:** Entries save. Running balance calculates correctly. Linked invoice FKs resolve.

---

### Prompt 9-B: Shareholder Book Calculator
Build the Shareholders tab calculation view. Once the trade ledger is complete, user clicks "Calculate Shareholder Book". System runs the calculation:
1. Gross profit = total client receipts − total supplier payments − total vendor payments
2. Identify non-taxable shareholders (invoicing through entity)
3. Calculate Tony's taxable share
4. Apply corporate tax rate
5. Distribute net profit equally per split %

Display the result clearly. Allow admin to confirm the book (locks it). Generate a shareholder statement per person.

**Inspect:** Calculation matches the confirmed formula. Tax applies to correct base. Locking works.

---

## Phase 10 — Dashboard & Judy

### Prompt 10-A: Dashboard Data
Populate the dashboard with live data from Supabase: open trades, pending document reviews (ChatGPT drafts awaiting confirmation), outstanding client payments, outstanding supplier payments, profit summary across settled trades, recent activity feed.

**Inspect:** All data loads correctly. Partners only see their trade data. Numbers are accurate.

---

### Prompt 10-B: Judy — OpenAI Integration
Integrate the OpenAI API as Judy, an in-platform assistant. Build a persistent chat panel (slide-out from the right side on any page). Judy has access to the current trade context (trade ID, order lines, costs, ledger) and can answer questions, flag anomalies, summarize trade status, and assist with document preparation. All API calls are server-side.

**Inspect:** Chat opens and responds. Context includes current trade data. Responses are relevant.

---

### Prompt 10-C: Judy — Supplier Invoice Matching
Teach Judy to compare an incoming supplier invoice (uploaded image or Excel) against Rock Hill's outgoing supplier invoice for the same trade. Judy flags any line items where quantities or prices differ. Result displayed in the Documents tab as a discrepancy report.

**Inspect:** Judy correctly identifies matching and mismatching lines. Discrepancy saves to `supplier_invoices_incoming.discrepancy_notes`.

---

### Prompt 10-D: ChatGPT Draft Review Panel
Build a dedicated review panel (accessible from the dashboard) showing all records written by ChatGPT that are still in `draft` status. User can review each item, edit if needed, and confirm or reject. Confirmed items update their status. Rejected items are flagged for re-entry.

**Inspect:** Draft records list correctly. Confirm/reject updates status. Dashboard count updates.

---

### Prompt 10-E: Email Integration (Resend)
Integrate Resend for transactional email from `sales@rockhillinnovation.com`. Wire up: user invitation emails (when admin creates an account), document delivery (attach generated PDF and send to client or supplier email directly from the app), and Judy alert emails (price anomaly, pending review reminders).

**Inspect:** Invitation email delivers. Document email sends with correct PDF attached. Judy alerts send.

---

## Summary

| Phase | Prompts | Focus |
|---|---|---|
| 1 | 1-A → 1-E | Foundation: project setup, schema, auth, users, layout |
| 2 | 2-A → 2-E | Master data: clients, suppliers, vendors, product catalog |
| 3 | 3-A → 3-D | Trade management: creation, order lines, bundle expansion, shareholders |
| 4 | 4-A → 4-C | Supplier quote tracker with versioning and comparison |
| 5 | 5-A → 5-B | Client quotation tracker |
| 6 | 6-A → 6-B | Document library with OneDrive integration |
| 7 | 7-A → 7-E | Document generation: pro forma, invoices, vendor invoices |
| 8 | 8-A | Exchange rate management |
| 9 | 9-A → 9-B | Bookkeeping: trade ledger and shareholder book |
| 10 | 10-A → 10-E | Dashboard, Judy AI assistant, email |

**Total: 26 prompts**
