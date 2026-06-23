# Rock Hill Innovation — Web Platform Plan

## Overview

A custom web-based operations platform for Rock Hill Innovation Inc., replacing the current Excel/file-based workflow. Built collaboratively with AI assistance. The system manages the full trade lifecycle: supplier quotes, client quotations, product costing, document generation, bookkeeping, and shareholder profit distribution.

**Database:** Supabase (PostgreSQL)  
**AI Layer:** ChatGPT (remote data entry + OCR via Supabase MCP) + Judy (in-platform assistant)  
**File Storage:** OneDrive integration for large files (AI/PDF design files, shipping documents)

---

## User Roles & Access

| Role | User(s) | Access |
|---|---|---|
| Admin | Tony | Full access. Creates and manages all accounts. |
| Manager | Michael | All trade and financial access. No user/account management. |
| Project Partner | Amish (and future partners) | Sees only trades they are assigned to. Invisible trades are completely hidden, not just locked. |

- No self-signup. Accounts are invitation-only, created by Admin.
- When a trade is created, Admin assigns which Project Partners have access to it.

---

## AI Architecture

### ChatGPT (Remote / Mobile)
- Connected to Supabase via MCP
- System prompt pre-loaded with Rock Hill business rules
- Used when away from computer
- Handles: quote image OCR, data extraction, writing structured records into Supabase
- All ChatGPT-written records are saved as **draft / pending review** — never auto-confirmed

### Judy (In-Platform Web Assistant)
- Embedded AI assistant throughout the web app
- Reads from the same Supabase database
- Assists with: reviewing ChatGPT-recorded data, document generation, trade status summaries, cost analysis, anomaly flagging, profit share calculations, general questions

### Key Rule
ChatGPT writes → Supabase stores → Judy and web app retrieve and act. Supabase is the single source of truth.

---

## Modules

### 1. Supplier Quote Tracker

**Problem:** Supplier sends quote images in RMB. Multiple rounds of revision per order. Hard to track which version is current. Hard to compare costs across orders.

**Solution:**
- Upload supplier quote image per order (image stored on OneDrive, link stored in DB)
- ChatGPT reads the image and extracts line items, quantities, and RMB prices into Supabase as a draft
- Judy or user confirms the extracted data on the web
- Each submission is a new **revision** — all revisions are kept, latest is flagged as active
- All quotes linked to the correct trade and supplier
- Cost comparison view: see price history for any component across past orders

**Key data points per quote line:**
- Component / item name (Chinese + English)
- RMB unit price
- Quantity
- Quote date
- Revision number
- Status (draft / confirmed)
- Outsourced or produced by supplier (affects payment split)

---

### 2. Client Quotation Tracker

**Problem:** Back-and-forth quotation history with clients. Occasional need to reference past order quotation history.

**Solution:**
- Same versioning model as supplier quotes but outgoing (Rock Hill → Client)
- Each revision stored and linked to the trade
- Historical view: what was quoted to this client for this item in past orders
- Status per revision: draft / sent / accepted / rejected

---

### 3. Document Library (Trade Files)

**Problem:** Design files, print files, revision proofs, approvals, shipping manifests, packing lists — many files, easily mixed up, hard to track status and version.

**Solution:**
- All files stored on OneDrive (files can be very large: .ai, .pdf)
- System stores metadata only: file name, version, type, status, date, linked trade/item, OneDrive link
- Each file has a status: draft / sent / approved / sent to printer / archived
- File types covered:
  - Design: AI files, dielines, print-ready files, revision proofs, approval confirmations
  - Shipping: manifests, packing lists, bills of lading, customs documents, inspection reports, delivery proofs
  - Other: any trade-related document
- Files are organized by trade, then by category
- Back-and-forth revisions tracked as versions under the same file record

---

### 4. Product Catalog

**Problem:** Some sellable items are sets made of multiple components. Need a master definition of what each product is made of before costing can be automated.

**Solution:**
- Master list of all products (parts and sets)
- Each product marked as: standalone part or set
- For sets: define which components it contains and quantity per unit
- This catalog is the source of truth for all cost calculations

**Example:**
```
Tasting Set (Set)
  └── P-Set: Tasting Set Box - 50ml x 3 (qty: 1)
  └── P-Paddle3H: Wooden Paddle - 3 Hole (qty: 1)
  └── P-ShooterPrint: 30ml Shooter Cup - Printed Logo (qty: 1)
  └── A-Cup: Assembly Labor - Cup (qty: 1)
  └── A-Paddle: Assembly Labor - Paddle (qty: 1)
```

---

### 5. Cost Engine

**Problem:** Supplier quotes in RMB. Sets must be costed component by component. Exchange rate varies per payment. Need to see estimated vs. actual USD cost.

**Solution:**
- Pull latest confirmed supplier quote per component from the quote tracker
- Expand sets using the product catalog definition
- Calculate total component cost in RMB
- Apply a **working exchange rate** for estimated USD cost during the order
- Lock exchange rate **per payment** (deposit rate, final payment rate) once payments are made
- Show both: estimated USD cost (working rate) and actual USD cost (locked rate per payment)
- Cost history view: track RMB and USD cost per component across all orders

---

### 6. Document Generation

All generated documents use fixed templates. Formatting is always consistent, including across page breaks.

#### Client-Facing
| Document | Notes |
|---|---|
| Pro-Forma Invoice | Generated from trade data using MLP template |
| Client Invoice (Full) | Full payment version |
| Client Invoice (Deposit) | 50% deposit, suffix `-D` |
| Client Invoice (Final) | Remaining 50% |

**Client payment rule:** 50% deposit, 50% final (per trade).

#### Supplier-Facing (Outgoing — Rock Hill's version)
| Document | Notes |
|---|---|
| Supplier Invoice (Deposit) | Outsourced items: 100% of their value. Produced items: 50%. |
| Supplier Invoice (Final) | Produced items: remaining 50% + all misc. expenses |

**Supplier payment rules per line item:**
- Outsourced items (wooden trays, cups, etc.) → 100% at deposit
- Produced items (printed boxes, etc.) → 50% deposit / 50% final
- Misc. expenses (domestic freight, pallets, cartons, samples, UPS, etc.) → added to final payment only

The system must know per component whether it is outsourced or produced.

#### Supplier-Facing (Incoming — their version)
- Uploaded as image or Excel
- Stored on OneDrive with metadata in DB
- ChatGPT extracts line items for comparison against Rock Hill's version
- Discrepancies flagged by Judy

---

### 7. Expense Vendor Management

Rock Hill creates invoices on behalf of expense vendors using their letterheads. No invoices are received — Rock Hill generates and sends them.

| Vendor | Code | Type |
|---|---|---|
| Chenlaw Financial & Legal Consulting Group Limited | CHENLAW | Legal |
| R H Services & Maintenance Ltd. | RH-SERVICES | Maintenance/Handling |
| SGRACO Consulting Inc. | SGRACO | Consulting (Amish) |
| LM Financial & Legal Consulting Group Ltd | LM-CONSULTING | Consulting (Michael) |
| ROCK HILL CO., LTD | ROCK-HILL-CO | Related company |

**Per vendor:**
- Letterhead/template stored in system
- Admin fills in details (amount, date, description, linked trade)
- System generates invoice in vendor's format
- Recorded as a trade expense or general company expense
- These are expenses — not commissions — and reduce profit before shareholder split

---

### 8. Bookkeeping

Two layers per trade:

#### Layer 1 — Trade Bookkeeping
Running ledger for all money in and out for a specific trade:
- Payments received from client (date, amount, currency, order reference)
- Payments sent to supplier (date, amount, RMB + USD at locked exchange rate)
- Banking fees (per transaction)
- Expense vendor payments
- Reimbursements
- Misc. credits or debits

#### Layer 2 — Shareholder Bookkeeping
Derived from the trade ledger once the trade is settled. Calculated automatically.

**Tax and split rules (configurable per trade):**
- Corporate tax rate (default: 12%, overridable per trade)
- Shareholders in this trade and their split %
- Which shareholders invoice through external entities (their share treated as pre-tax expense)

**Calculation logic:**
- Gross profit = total sales − total costs (RMB converted to USD at locked rates) − expense vendor invoices
- Identify which shareholders invoice through external entities (currently Michael via LM, Amish via SGRACO)
- Tony's share = gross profit ÷ number of shareholders
- Corporate tax = Tony's share × tax rate
- Tax is shared equally among all shareholders
- Net each person receives = (gross profit − corporate tax) ÷ number of shareholders

**Example (MLP trade, 3 shareholders, $90,000 profit):**
```
Gross Profit:         $90,000
Tony's share (1/3):   $30,000  ← only this portion is taxable
Corporate tax (12%):   $3,600  ← shared equally among 3
Net after tax:        $86,400
Each person receives: $28,800
```

**Trade-level shareholder settings:**
- Which shareholders participate
- Their split percentages
- Who invoices through external entity
- Corporate tax rate

---

### 9. Company Profiles

#### Clients
- Company name, code, country, currency, contacts
- Payment terms (e.g. 50/50 deposit/final)
- Default document template
- Trade history

#### Suppliers
- Company name, code, country, currency (RMB)
- Contact info
- Invoice format (image or Excel)
- Trade history

---

### 10. Dashboard

Command center showing:
- Open trades and their status
- Pending documents (drafts waiting for review/approval)
- Outstanding client payments (what's owed to Rock Hill)
- Outstanding supplier payments (what Rock Hill owes)
- Profit summary across trades
- Shareholder balance summary
- Recent ChatGPT activity (what was recorded remotely, pending review)
- Judy quick-access panel

---

## Exchange Rate Handling

| Stage | Rate Used |
|---|---|
| During order (estimate) | Working rate — manually entered, used for estimates only |
| Deposit payment | Agreed rate manually entered and locked at time of payment |
| Final payment | Agreed rate manually entered and locked at time of payment (may differ from deposit) |

- All supplier costs originate in RMB — RMB is the source of truth
- USD equivalent is calculated per payment using the locked rate for that payment
- System stores both RMB amount and USD equivalent for every supplier transaction
- Average rate = (deposit rate + final rate) ÷ 2 — calculated at book close for reference only, does not affect actual costs
- No exchange gain/loss tracking — rate differences are simply reflected as a change in USD cost
- A reference exchange rate (from an external API) is displayed alongside the manual entry field for comparison — bank trade rate, not published mid-market rate
- TWD is not used anywhere in the system

---

## UI Design

**Style:** Clean and professional. Light background, structured layouts, minimal decoration.

**Layout:** Fixed left sidebar navigation with all modules listed. Main content area to the right.

**Component Library:** shadcn/ui — modern, highly customizable, pairs natively with Next.js. Provides clean data tables, modals, forms, and command palette out of the box.

**Data Density:** Comfortable — generous spacing, easy to scan at a glance.

**Color Palette:** Professional palette to be designed (no existing brand colors):
- Primary: deep navy or slate — used for sidebar, headers, primary actions
- Background: light neutral gray/white — main content area
- Accent: single highlight color for buttons, badges, and active states
- Typography: clean sans-serif, high contrast for readability

**Responsive:** Desktop-first. The app is primarily used at a desk; mobile layout is secondary.

---

## Tech Stack Recommendation

| Layer | Technology | Reason |
|---|---|---|
| Database | Supabase (PostgreSQL) | Already chosen. Real-time, row-level security for user permissions, works with ChatGPT MCP |
| Backend / API | Node.js + Express or Next.js API routes | JavaScript throughout, works well with Supabase client |
| Frontend | Next.js (React) | Full-stack framework, good for document generation, server-side rendering |
| File Storage | OneDrive (Microsoft Graph API) — fresh folder structure | Large file support (.ai, .pdf). Metadata and links stored in Supabase, files live on OneDrive |
| AI (remote) | ChatGPT with Supabase MCP | Already planned |
| AI (in-platform) | OpenAI GPT API (Judy) | Embedded assistant with access to trade context |
| Document Generation | Puppeteer (HTML/CSS → PDF) | Templates are built once in pixel-precise HTML/CSS. Puppeteer renders them identically every time — professional output, consistent pagination, repeating headers/footers across pages. Existing templates provided by Tony are recreated precisely before any document is generated. |
| Exchange Rate Reference | exchangerate.host or Open Exchange Rates API | Reference rate only — shown alongside manual entry for comparison |
| Authentication | Supabase Auth | Built-in, supports role-based access, no self-signup |
| Hosting | Vercel (frontend) + Supabase (backend) | Simple deployment, scalable |
| Domain | www.rockhillinnovation.com | Registered. DNS managed by Cloudflare. |
| Cloudflare | DNS + Proxy (CDN) | Sits in front of Vercel. Provides DDoS protection, SSL, and global CDN caching. CNAME record points www to Vercel deployment URL with Cloudflare proxy enabled. Supabase Auth and Microsoft Graph OAuth redirect URIs must be set to https://www.rockhillinnovation.com. |
| Email | Resend (sales@rockhillinnovation.com) | Transactional email API. Domain verified via DNS records in Cloudflare. Used for: document delivery (pro formas, invoices), user invitations, and Judy notifications (pending reviews, payment reminders, price anomalies). |

---

## Supabase Row-Level Security (RLS) for Permissions

Supabase RLS enforces access at the database level — not just the UI:
- Admin → sees everything
- Manager → sees all trades, no user management tables
- Project Partner → only sees trades where they are listed as a participant

This means even if someone tried to access data directly, the database would block it.

---

## Build Phases

### Phase 1 — Foundation
- Supabase schema design (all tables, relationships, RLS policies)
- Authentication: login, account creation by admin, role assignment
- Company profiles: clients and suppliers
- Product catalog: parts and sets with component definitions
- Basic dashboard shell

### Phase 2 — Quote Management
- Supplier quote tracker with versioning and image upload to OneDrive
- Client quotation tracker with versioning
- ChatGPT integration for quote image OCR → Supabase
- Judy integration for reviewing extracted quotes

### Phase 3 — Order & Cost Engine
- Trade creation and management
- Component demand expansion from product catalog
- Cost calculation in RMB + USD estimate
- Exchange rate per payment locking
- Actual vs. estimated cost tracking

### Phase 4 — Document Generation
- Client pro-forma invoice
- Client deposit and final invoices
- Supplier deposit and final invoices (Rock Hill's version)
- Supplier incoming invoice upload and storage
- Expense vendor invoice generation (with letterheads)
- Consistent pagination and formatting

### Phase 5 — Document Library
- Full trade document library (design files, shipping docs)
- OneDrive upload integration
- File metadata, versioning, status tracking

### Phase 6 — Bookkeeping
- Trade ledger (payments in/out, banking fees, expenses, reimbursements)
- Shareholder bookkeeping with per-trade tax rules
- Automated profit and commission calculation
- Shareholder statements

### Phase 7 — Dashboard & Judy
- Full dashboard with trade status, payment tracking, profit summary
- Judy assistant fully wired to all trade data
- ChatGPT activity review panel
- Notifications and alerts (price anomalies, missing documents, pending reviews)

---

## Confirmed Decisions

| Decision | Confirmed |
|---|---|
| Reporting currency | USD and RMB only. No TWD. |
| Commission | No commission system. Shareholder profit split is the distribution mechanism. |
| Exchange gains/losses | Not tracked. Rate difference is reflected as a change in USD cost only. Average rate calculated at book close for reference. |
| Document generation method | Puppeteer (HTML/CSS → PDF). Templates recreated precisely from Tony's existing files before build. |
| OneDrive structure | Fresh start. New folder structure designed around the new system. |
| Exchange rate entry | Manual entry per transaction. Reference rate from external API shown alongside for comparison (bank trade rate). |
