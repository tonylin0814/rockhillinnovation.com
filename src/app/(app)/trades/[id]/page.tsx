import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientQuotationsTab } from "@/components/trades/ClientQuotationsTab";
import { DocumentsTab } from "@/components/trades/DocumentsTab";
import { ExchangeRatesCard } from "@/components/trades/ExchangeRatesCard";
import { InvoicesTab } from "@/components/trades/InvoicesTab";
import { JudyChat } from "@/components/trades/JudyChat";
import { LedgerTab } from "@/components/trades/LedgerTab";
import { ManagePartnersDialog } from "@/components/trades/ManagePartnersDialog";
import { OrderLinesTab } from "@/components/trades/OrderLinesTab";
import { ShareholderBookCard } from "@/components/trades/ShareholderBookCard";
import { ShareholderRulesEditor } from "@/components/trades/ShareholderRulesEditor";
import { SupplierQuotesTab } from "@/components/trades/SupplierQuotesTab";
import { TradeEditDialog } from "@/components/trades/TradeEditDialog";
import { TradeStatusDropdown } from "@/components/trades/TradeStatusDropdown";
import { VendorInvoicesCard } from "@/components/trades/VendorInvoicesCard";
import type { TradeClientOption, TradePartnerOption } from "@/components/trades/NewTradeDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ClientInvoice,
  ClientQuotationSession,
  ComponentDemand,
  ExchangeRate,
  ExpenseVendorInvoice,
  ExpenseVendor,
  OrderLine,
  Product,
  ShareholderBook,
  SupplierQuoteSession,
  SupplierInvoiceOutgoing,
  Trade,
  TradeDocument,
  TradeLedgerEntry,
  TradeParticipant,
  TradeShareholder,
  UserRole,
} from "@/types";

const statusClasses: Record<Trade["status"], string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  active: "border-blue-200 bg-blue-50 text-blue-700",
  settled: "border-green-200 bg-green-50 text-green-700",
  archived: "border-red-200 bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: Trade["status"] }) {
  return (
    <Badge className={statusClasses[status]} variant="outline">
      {status}
    </Badge>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge className="border-violet-200 bg-violet-50 text-violet-700" variant="outline">
      {role}
    </Badge>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatRate(rate: number | null) {
  return typeof rate === "number" ? `\u00A5${rate.toFixed(2)} / $1` : "-";
}

function formatPercent(value: number | undefined | null) {
  return typeof value === "number" ? `${value}%` : "-";
}
function formatTaxPercent(value: number | undefined | null) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "-";
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-[#0d1b34]">{value || "—"}</p>
    </div>
  );
}

function ComingSoonCard({ title }: { title: string }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-500">Coming soon.</CardContent>
    </Card>
  );
}

export default async function TradeWorkspacePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const currentRole: UserRole = user?.role ?? "partner";
  const canManage = currentRole !== "partner";
  const supabase = createServerSupabaseClient();

  const [
    { data, error },
    { data: participants, error: participantsError },
    { data: clients, error: clientsError },
    { data: partners, error: partnersError },
    { data: orderLines, error: orderLinesError },
    { data: componentDemand, error: componentDemandError },
    { data: activeProducts, error: activeProductsError },
    { data: tradeShareholders, error: tradeShareholdersError },
    { data: activeVendors, error: activeVendorsError },
    { data: quoteSessions, error: quoteSessionsError },
    { data: quotationSessions, error: quotationSessionsError },
    { data: tradeDocuments, error: tradeDocumentsError },
    { data: clientInvoices, error: clientInvoicesError },
    { data: supplierInvoicesOutgoing, error: supplierInvoicesOutgoingError },
    { data: vendorInvoices, error: vendorInvoicesError },
    { data: exchangeRates, error: exchangeRatesError },
    { data: ledgerEntries, error: ledgerEntriesError },
    { data: shareholderBook, error: shareholderBookError },
  ] = await Promise.all([
    supabase
      .from("trades")
      .select("*, client:clients(id, name, code, currency, deposit_pct, final_pct)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("trade_participants")
      .select("*, user:users(id, name, email, role)")
      .eq("trade_id", params.id),
    canManage
      ? supabase.from("clients").select("id, name, code").eq("status", "active").order("name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    canManage
      ? supabase
          .from("users")
          .select("id, name, email")
          .eq("role", "partner")
          .eq("is_active", true)
          .order("code", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("order_lines")
      .select("*, product:products(id, code, supplier_product_code, name_english, product_type)")
      .eq("trade_id", params.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("component_demand")
      .select("*, product:products(id, code, supplier_product_code, name_english, name_chinese, payment_category)")
      .eq("trade_id", params.id)
      .order("product_id", { ascending: true }),
    supabase
      .from("products")
      .select("id, code, supplier_product_code, name_english, product_type")
      .eq("status", "active")
      .order("code", { ascending: true }),
    supabase
      .from("trade_shareholders")
      .select("*, expense_vendor:expense_vendors(id, name, code, address, letterhead_onedrive_url)")
      .eq("trade_id", params.id)
      .order("person_name", { ascending: true }),
    supabase
      .from("expense_vendors")
      .select("id, name, code")
      .eq("status", "active")
      .order("code", { ascending: true }),
    supabase
      .from("supplier_quote_sessions")
      .select("*")
      .eq("trade_id", params.id)
      .order("session_number", { ascending: false }),
    supabase
      .from("client_quotation_sessions")
      .select("*, client:clients(id, name, code)")
      .eq("trade_id", params.id)
      .order("session_number", { ascending: false }),
    supabase
      .from("trade_documents")
      .select("*, uploader:users(id, name)")
      .eq("trade_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_invoices")
      .select("*")
      .eq("trade_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("supplier_invoices_outgoing")
      .select("*")
      .eq("trade_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("expense_vendor_invoices")
      .select("*")
      .eq("trade_id", params.id)
      .order("created_at", { ascending: false }),
    supabase.from("exchange_rates").select("*").eq("trade_id", params.id),
    supabase
      .from("trade_ledger")
      .select(
        "*, client_invoice:client_invoices(id, invoice_number), supplier_invoice:supplier_invoices_outgoing(id, invoice_number), vendor_invoice:expense_vendor_invoices(id, invoice_number), recorder:users(id, name)"
      )
      .eq("trade_id", params.id)
      .order("entry_date", { ascending: false }),
    supabase
      .from("shareholder_book")
      .select("*, lines:shareholder_book_lines(*)")
      .eq("trade_id", params.id)
      .maybeSingle(),
  ]);

  if (
    error ||
    participantsError ||
    clientsError ||
    partnersError ||
    orderLinesError ||
    componentDemandError ||
    activeProductsError ||
    tradeShareholdersError ||
    activeVendorsError ||
    quoteSessionsError ||
    quotationSessionsError ||
    tradeDocumentsError ||
    clientInvoicesError ||
    supplierInvoicesOutgoingError ||
    vendorInvoicesError ||
    exchangeRatesError ||
    ledgerEntriesError ||
    shareholderBookError
  ) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error?.message ??
          participantsError?.message ??
          clientsError?.message ??
          partnersError?.message ??
          orderLinesError?.message ??
          componentDemandError?.message ??
          activeProductsError?.message ??
          tradeShareholdersError?.message ??
          activeVendorsError?.message ??
          quoteSessionsError?.message ??
          quotationSessionsError?.message ??
          tradeDocumentsError?.message ??
          clientInvoicesError?.message ??
          supplierInvoicesOutgoingError?.message ??
          vendorInvoicesError?.message ??
          exchangeRatesError?.message ??
          ledgerEntriesError?.message ??
          shareholderBookError?.message}
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const trade = data as Trade;
  const tradeParticipants = (participants ?? []) as TradeParticipant[];
  const clientOptions = (clients ?? []) as TradeClientOption[];
  const partnerOptions = (partners ?? []) as TradePartnerOption[];
  const orderLineRows = (orderLines ?? []) as OrderLine[];
  const componentDemandRows = (componentDemand ?? []) as ComponentDemand[];
  const activeProductOptions = (activeProducts ?? []) as Product[];
  const tradeShareholderRows = (tradeShareholders ?? []) as TradeShareholder[];
  const activeVendorOptions = (activeVendors ?? []) as ExpenseVendor[];
  const quoteSessionRows = (quoteSessions ?? []) as SupplierQuoteSession[];
  const quotationSessionRows = (quotationSessions ?? []) as ClientQuotationSession[];
  const tradeDocumentRows = (tradeDocuments ?? []) as TradeDocument[];
  const clientInvoiceRows = (clientInvoices ?? []) as ClientInvoice[];
  const supplierInvoiceOutgoingRows = (supplierInvoicesOutgoing ?? []) as SupplierInvoiceOutgoing[];
  const vendorInvoiceRows = (vendorInvoices ?? []) as ExpenseVendorInvoice[];
  const exchangeRateRows = (exchangeRates ?? []) as ExchangeRate[];
  const ledgerEntryRows = (ledgerEntries ?? []) as TradeLedgerEntry[];
  const shareholderBookData = (shareholderBook ?? null) as ShareholderBook | null;
  const participantPartnerIds = tradeParticipants.map((participant) => participant.user_id);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link className="text-sm font-medium text-slate-500 transition-colors hover:text-[#0d1b34]" href="/trades">
            Back to Trades
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-3xl font-semibold text-[#0d1b34]">{trade.trade_id}</h1>
            <StatusBadge status={trade.status} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {trade.client?.name ?? "No client"}
            {trade.order_number ? ` - Order ${trade.order_number}` : ""}
            {` - ${formatDate(trade.trade_date)}`}
          </p>
        </div>
        <TradeStatusDropdown currentStatus={trade.status} role={currentRole} tradeId={trade.id} />
      </div>

      <Tabs className="space-y-4" defaultValue="summary">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="order-lines">Order Lines</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="shareholders">Shareholders</TabsTrigger>
          <TabsTrigger value="judy">Judy AI</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Trade Details</CardTitle>
                {canManage ? (
                  <TradeEditDialog
                    clients={clientOptions}
                    trade={trade}
                    trigger={
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    }
                  />
                ) : null}
              </CardHeader>
              <CardContent>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <DetailRow label="Trade ID" value={trade.trade_id} />
                  <DetailRow label="Order Number" value={trade.order_number} />
                  <DetailRow label="Trade Date" value={formatDate(trade.trade_date)} />
                  <DetailRow
                    label="Client"
                    value={trade.client?.code ?? null}
                  />
                  <DetailRow label="Working Exchange Rate" value={formatRate(trade.working_exchange_rate)} />
                  <DetailRow label="Corporate Tax Rate" value={formatTaxPercent(trade.corporate_tax_rate)} />
                </div>
                <DetailRow label="Notes" value={trade.notes} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Client Payment Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <DetailRow label="Deposit" value={formatPercent(trade.client?.deposit_pct)} />
                  <DetailRow label="Final" value={formatPercent(trade.client?.final_pct)} />
                  <DetailRow label="Currency" value={trade.client?.currency ?? null} />
                </div>
              </CardContent>
            </Card>

            <ExchangeRatesCard canManage={canManage} initialRates={exchangeRateRows} tradeId={trade.id} />
          </div>
        </TabsContent>

        <TabsContent value="quotes">
          <SupplierQuotesTab
            availableProducts={activeProductOptions}
            canManage={canManage}
            initialSessions={quoteSessionRows}
            tradeId={trade.id}
          />
        </TabsContent>
        <TabsContent value="quotations">
          <ClientQuotationsTab canManage={canManage} initialSessions={quotationSessionRows} tradeId={trade.id} />
        </TabsContent>
        <TabsContent value="order-lines">
          <OrderLinesTab
            availableProducts={activeProductOptions}
            canManage={canManage}
            initialDemand={componentDemandRows}
            initialLines={orderLineRows}
            tradeId={trade.id}
            workingExchangeRate={trade.working_exchange_rate}
          />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab initialDocuments={tradeDocumentRows} tradeCode={trade.trade_id} tradeId={trade.id} />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab
            canManage={canManage}
            initialInvoices={clientInvoiceRows}
            initialSupplierInvoices={supplierInvoiceOutgoingRows}
            tradeId={trade.id}
          />
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerTab
            canManage={canManage}
            clientInvoices={clientInvoiceRows}
            exchangeRates={exchangeRateRows}
            initialEntries={ledgerEntryRows}
            supplierInvoices={supplierInvoiceOutgoingRows}
            tradeId={trade.id}
            vendorInvoices={vendorInvoiceRows}
          />
        </TabsContent>

        <TabsContent value="shareholders">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Project Partners</CardTitle>
              {canManage ? (
                <ManagePartnersDialog
                  initialPartnerIds={participantPartnerIds}
                  partners={partnerOptions}
                  tradeId={trade.id}
                  trigger={
                    <Button size="sm" variant="outline">
                      Manage Partners
                    </Button>
                  }
                />
              ) : null}
            </CardHeader>
            <CardContent>
              {tradeParticipants.length ? (
                <div className="grid gap-3">
                  {tradeParticipants.map((participant) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
                      key={participant.id}
                    >
                      <div>
                        <p className="font-medium text-[#0d1b34]">{participant.user?.name ?? "Unknown user"}</p>
                        <p className="text-sm text-slate-500">{participant.user?.email ?? "-"}</p>
                      </div>
                      <RoleBadge role={participant.user?.role ?? "partner"} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No partners assigned yet.</p>
              )}
            </CardContent>
          </Card>
          <ShareholderRulesEditor
            availableVendors={activeVendorOptions}
            canManage={canManage}
            initialShareholders={tradeShareholderRows}
            tradeId={trade.id}
          />
          <VendorInvoicesCard
            canManage={canManage}
            existingInvoices={vendorInvoiceRows}
            shareholders={tradeShareholderRows}
            tradeId={trade.id}
          />
          <ShareholderBookCard book={shareholderBookData} canManage={canManage} tradeId={trade.id} />
        </TabsContent>
        <TabsContent value="judy">
          <JudyChat tradeId={trade.id} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
