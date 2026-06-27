import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityLogTable } from "@/components/admin/ActivityLogTable";
import { ClientQuotationsTab } from "@/components/trades/ClientQuotationsTab";
import { DevelopmentTab } from "@/components/trades/DevelopmentTab";
import { DiaryTab } from "@/components/trades/DiaryTab";
import { DocumentsTab } from "@/components/trades/DocumentsTab";
import { ExchangeRatesCard } from "@/components/trades/ExchangeRatesCard";
import { FinancialTab } from "@/components/trades/FinancialTab";
import { InvoicesTab } from "@/components/trades/InvoicesTab";
import { JudyChat } from "@/components/trades/JudyChat";
import { LedgerTab } from "@/components/trades/LedgerTab";
import { ManagePartnersDialog } from "@/components/trades/ManagePartnersDialog";
import { PackingTab } from "@/components/trades/PackingTab";
import { ShareholderRulesEditor } from "@/components/trades/ShareholderRulesEditor";
import { SupplierQuotesTab } from "@/components/trades/SupplierQuotesTab";
import { TradeEditDialog } from "@/components/trades/TradeEditDialog";
import { TradeMilestoneChecklist } from "@/components/trades/TradeMilestoneChecklist";
import { TradePnlCard } from "@/components/trades/TradePnlCard";
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
  ExchangeRate,
  ExpenseVendorInvoice,
  ExpenseVendor,
  Product,
  ShareholderBook,
  SupplierQuoteSession,
  SupplierInvoiceOutgoing,
  Trade,
  TradeDiaryEntry,
  TradeDevelopmentCost,
  TradeDevelopmentVersion,
  TradeDocument,
  TradeExpense,
  TradeLedgerEntry,
  TradeMilestone,
  TradePackingPlan,
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
  return typeof rate === "number" ? `\u00A5${rate.toFixed(4)} / $1` : "-";
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
  const canManage = currentRole === "admin" || currentRole === "manager";
  const canViewFinancials = canManage;
  const supabase = createServerSupabaseClient();

  const [
    { data, error },
    { data: participants, error: participantsError },
    { data: clients, error: clientsError },
    { data: partners, error: partnersError },
    { data: activeProducts, error: activeProductsError },
    { data: tradeShareholders, error: tradeShareholdersError },
    { data: activeVendors, error: activeVendorsError },
    { data: activeSuppliers, error: activeSuppliersError },
    { data: quoteSessions, error: quoteSessionsError },
    { data: quotationSessions, error: quotationSessionsError },
    { data: tradeDocuments, error: tradeDocumentsError },
    { data: clientInvoices, error: clientInvoicesError },
    { data: supplierInvoicesOutgoing, error: supplierInvoicesOutgoingError },
    { data: vendorInvoices, error: vendorInvoicesError },
    { data: exchangeRates, error: exchangeRatesError },
    { data: ledgerEntries, error: ledgerEntriesError },
    { data: milestones, error: milestonesError },
    { data: shareholderBook, error: shareholderBookError },
    { data: devVersions, error: devVersionsError },
    { data: devCosts, error: devCostsError },
    { data: diaryEntries, error: diaryEntriesError },
    { data: packingPlan, error: packingPlanError },
    { data: acceptedQuotationLines, error: acceptedQuotationLinesError },
    { data: confirmedQuoteLines, error: confirmedQuoteLinesError },
    { data: tradeExpenses, error: tradeExpensesError },
  ] = await Promise.all([
    supabase
      .from("trades")
      .select("*, client:clients(id, name, code, currency, deposit_pct, final_pct)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("trade_participants")
      .select("*, user:users!trade_participants_user_id_fkey(id, name, email, role)")
      .eq("trade_id", params.id),
    canManage
      ? supabase.from("clients").select("id, name, code").eq("status", "active").order("name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    canManage
      ? supabase
          .from("users")
          .select("id, name, email")
          .in("role", ["partner", "manager"])
          .eq("is_active", true)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("products")
      .select("id, code, supplier_product_code, name_english, product_type")
      .eq("status", "active")
      .order("name_english", { ascending: true })
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
      .from("suppliers")
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
      .select("*, lines:client_invoice_lines(*)")
      .eq("trade_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("supplier_invoices_outgoing")
      .select("*, adjustments:supplier_invoice_adjustments(*), lines:supplier_invoice_outgoing_lines(*)")
      .eq("trade_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("expense_vendor_invoices")
      .select("*, vendor:expense_vendors(id, name, code)")
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
    supabase.from("trade_milestones").select("*").eq("trade_id", params.id),
    supabase
      .from("shareholder_book")
      .select("*, lines:shareholder_book_lines(*)")
      .eq("trade_id", params.id)
      .maybeSingle(),
    supabase
      .from("trade_development_versions")
      .select("*, product:products(id, code, name_english)")
      .eq("trade_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("trade_development_costs")
      .select("*")
      .eq("trade_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("trade_diary_entries")
      .select("*")
      .eq("trade_id", params.id)
      .order("created_at", { ascending: false }),
    canManage
      ? supabase
          .from("trade_packing_plans")
          .select("*, pallets:trade_packing_pallets(*, cases:trade_packing_cases(*))")
          .eq("trade_id", params.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("client_quotation_lines")
      .select("total_price_usd, session:client_quotation_sessions!inner(status, trade_id)")
      .eq("client_quotation_sessions.trade_id", params.id)
      .eq("client_quotation_sessions.status", "accepted"),
    supabase
      .from("supplier_quote_lines")
      .select("total_price_rmb, product:products(product_type), session:supplier_quote_sessions!inner(status, trade_id)")
      .eq("supplier_quote_sessions.trade_id", params.id)
      .eq("supplier_quote_sessions.status", "confirmed"),
    supabase
      .from("trade_expenses")
      .select("*")
      .eq("trade_id", params.id)
      .order("expense_date", { ascending: false }),
  ]);

  if (
    error ||
    participantsError ||
    clientsError ||
    partnersError ||
    activeProductsError ||
    tradeShareholdersError ||
    activeVendorsError ||
    activeSuppliersError ||
    quoteSessionsError ||
    quotationSessionsError ||
    tradeDocumentsError ||
    clientInvoicesError ||
    supplierInvoicesOutgoingError ||
    vendorInvoicesError ||
    exchangeRatesError ||
    ledgerEntriesError ||
    milestonesError ||
    shareholderBookError ||
    devVersionsError ||
    devCostsError ||
    diaryEntriesError ||
    packingPlanError ||
    acceptedQuotationLinesError ||
    confirmedQuoteLinesError ||
    tradeExpensesError
  ) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error?.message ??
          participantsError?.message ??
          clientsError?.message ??
          partnersError?.message ??
          activeProductsError?.message ??
          tradeShareholdersError?.message ??
          activeVendorsError?.message ??
          activeSuppliersError?.message ??
          quoteSessionsError?.message ??
          quotationSessionsError?.message ??
          tradeDocumentsError?.message ??
          clientInvoicesError?.message ??
          supplierInvoicesOutgoingError?.message ??
          vendorInvoicesError?.message ??
          exchangeRatesError?.message ??
          ledgerEntriesError?.message ??
          milestonesError?.message ??
          shareholderBookError?.message ??
          devVersionsError?.message ??
          devCostsError?.message ??
          diaryEntriesError?.message ??
          packingPlanError?.message ??
          acceptedQuotationLinesError?.message ??
          confirmedQuoteLinesError?.message ??
          tradeExpensesError?.message}
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const activeProductRows = (activeProducts ?? []) as Product[];
  const activeProductIds = activeProductRows.map((product) => product.id);
  const latestCostByProductId = new Map<string, number>();
  const previousCostByProductId = new Map<string, number>();
  const setComponentsByProductId = new Map<string, { component_product_id: string; quantity_per_set: number }[]>();

  if (canManage && activeProductIds.length) {
    const { data: setComponents, error: setComponentsError } = await supabase
      .from("product_components")
      .select("set_product_id, component_product_id, quantity_per_set")
      .in("set_product_id", activeProductIds);

    if (setComponentsError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {setComponentsError.message}
        </div>
      );
    }

    const costProductIds = new Set(activeProductIds);

    for (const component of (setComponents ?? []) as {
      component_product_id: string;
      quantity_per_set: number | string;
      set_product_id: string;
    }[]) {
      const componentList = setComponentsByProductId.get(component.set_product_id) ?? [];

      componentList.push({
        component_product_id: component.component_product_id,
        quantity_per_set: Number(component.quantity_per_set),
      });
      setComponentsByProductId.set(component.set_product_id, componentList);
      costProductIds.add(component.component_product_id);
    }

    const { data: latestCosts, error: latestCostsError } = await supabase
      .from("product_cost_history")
      .select("product_id, unit_cost_rmb")
      .in("product_id", Array.from(costProductIds))
      .order("quoted_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (latestCostsError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {latestCostsError.message}
        </div>
      );
    }

    for (const row of (latestCosts ?? []) as { product_id: string; unit_cost_rmb: number | string }[]) {
      if (!latestCostByProductId.has(row.product_id)) {
        latestCostByProductId.set(row.product_id, Number(row.unit_cost_rmb));
      } else if (!previousCostByProductId.has(row.product_id)) {
        previousCostByProductId.set(row.product_id, Number(row.unit_cost_rmb));
      }
    }
  }

  function resolveProductCost(product: Product, costs: Map<string, number>) {
    if (product.product_type !== "set") {
      return costs.get(product.id) ?? null;
    }

    const components = setComponentsByProductId.get(product.id) ?? [];

    if (!components.length) {
      return costs.get(product.id) ?? null;
    }

    let totalCost = 0;

    for (const component of components) {
      const componentCost = costs.get(component.component_product_id);

      if (componentCost === undefined) {
        return null;
      }

      totalCost += componentCost * component.quantity_per_set;
    }

    return totalCost;
  }

  const trade = data as Trade;
  let canEdit = canManage;

  if (currentRole === "user" && user) {
    const { data: grant } = await supabase
      .from("user_client_access")
      .select("access_level")
      .eq("user_id", user.id)
      .eq("client_id", trade.client_id)
      .maybeSingle();

    canEdit = grant?.access_level === "edit";
  }

  const tradeParticipants = (participants ?? []) as TradeParticipant[];
  const clientOptions = (clients ?? []) as TradeClientOption[];
  const partnerOptions = (partners ?? []) as TradePartnerOption[];
  const activeProductOptions = activeProductRows.map((product) => ({
    ...product,
    latest_cost_rmb: resolveProductCost(product, latestCostByProductId),
    previous_cost_rmb: resolveProductCost(product, previousCostByProductId),
  }));
  const tradeShareholderRows = (tradeShareholders ?? []) as TradeShareholder[];
  const activeVendorOptions = (activeVendors ?? []) as ExpenseVendor[];
  const activeSupplierOptions = (activeSuppliers ?? []) as { id: string; name: string; code: string }[];
  const quoteSessionRows = (quoteSessions ?? []) as SupplierQuoteSession[];
  const quotationSessionRows = (quotationSessions ?? []) as ClientQuotationSession[];
  const tradeDocumentRows = (tradeDocuments ?? []) as TradeDocument[];
  const clientInvoiceRows = (clientInvoices ?? []) as ClientInvoice[];
  const supplierInvoiceOutgoingRows = (supplierInvoicesOutgoing ?? []) as SupplierInvoiceOutgoing[];
  const vendorInvoiceRows = (vendorInvoices ?? []) as ExpenseVendorInvoice[];
  const vendorOutgoingInvoiceRows = vendorInvoiceRows.filter((invoice) => invoice.trade_shareholder_id === null);
  const shareholderVendorInvoiceRows = vendorInvoiceRows.filter((invoice) => invoice.trade_shareholder_id !== null);
  const exchangeRateRows = (exchangeRates ?? []) as ExchangeRate[];
  const ledgerEntryRows = (ledgerEntries ?? []) as TradeLedgerEntry[];
  const tradeMilestoneRows = (milestones ?? []) as TradeMilestone[];
  const shareholderBookData = (shareholderBook ?? null) as ShareholderBook | null;
  const developmentVersions = (devVersions ?? []) as TradeDevelopmentVersion[];
  const developmentCosts = (devCosts ?? []) as TradeDevelopmentCost[];
  const diaryEntryRows = (diaryEntries ?? []) as TradeDiaryEntry[];
  const normalizedPackingPlan = packingPlan
    ? ({
        ...packingPlan,
        pallets: ((packingPlan.pallets ?? []) as TradePackingPlan["pallets"])
          .map((pallet) => ({
            ...pallet,
            cases: [...(pallet.cases ?? [])].sort((a, b) => a.sort_order - b.sort_order),
          }))
          .sort((a, b) => a.sort_order - b.sort_order),
      } as TradePackingPlan)
    : null;
  const tradeExpenseRows = (tradeExpenses ?? []) as TradeExpense[];
  const shareholderBookConfirmed = shareholderBookData?.status === "confirmed";
  const depositRate = exchangeRateRows.find((rate) => rate.payment_type === "deposit") ?? null;
  const finalRate = exchangeRateRows.find((rate) => rate.payment_type === "final") ?? null;
  function round2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  const revenueUsd: number | null =
    acceptedQuotationLines && acceptedQuotationLines.length > 0
      ? round2(acceptedQuotationLines.reduce((sum, line) => sum + Number(line.total_price_usd ?? 0), 0))
      : null;

  const costRmb: number | null =
    confirmedQuoteLines && confirmedQuoteLines.length > 0
      ? round2(
          confirmedQuoteLines.reduce((sum, line) => {
            const product = Array.isArray(line.product) ? line.product[0] : line.product;

            if (product?.product_type === "set") {
              return sum;
            }

            return sum + Number(line.total_price_rmb ?? 0);
          }, 0)
        )
      : null;

  const absorbedDevCostRmb = round2(
    developmentCosts.filter((cost) => cost.is_absorbed).reduce((sum, cost) => sum + Number(cost.amount_rmb ?? 0), 0)
  );
  const absorbedDevCostCad = round2(
    developmentCosts.filter((cost) => cost.is_absorbed).reduce((sum, cost) => sum + Number(cost.amount_cad ?? 0), 0)
  );
  const absorbedDevCostUsd = round2(
    developmentCosts.filter((cost) => cost.is_absorbed).reduce((sum, cost) => sum + Number(cost.amount_usd ?? 0), 0)
  );

  function computeMargin(revenue: number | null, cost: number | null, rate: number | null) {
    if (revenue == null || cost == null || !rate) {
      return null;
    }

    const costUsd = round2(cost / rate);
    const margin = round2(revenue - costUsd);
    const marginPct = revenue > 0 ? round2((margin / revenue) * 100) : null;
    return { costUsd, margin, marginPct };
  }

  const workingPnl = computeMargin(revenueUsd, costRmb, trade.working_exchange_rate);
  const depositPnl = computeMargin(revenueUsd, costRmb, depositRate?.rate_rmb_per_usd ?? null);
  const finalPnl = computeMargin(revenueUsd, costRmb, finalRate?.rate_rmb_per_usd ?? null);
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
        {canManage ? (
          <TradeStatusDropdown
            currentStatus={trade.status}
            role={currentRole}
            shareholderBookConfirmed={shareholderBookConfirmed}
            tradeId={trade.id}
          />
        ) : null}
      </div>

      <Tabs className="space-y-4" defaultValue="summary">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="development">Development</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          {canManage ? <TabsTrigger value="packing">Packing</TabsTrigger> : null}
          <TabsTrigger value="ledger">Bookkeeping</TabsTrigger>
          {canViewFinancials ? <TabsTrigger value="financial">Financial</TabsTrigger> : null}
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {canManage ? <TabsTrigger value="shareholders">Shareholders</TabsTrigger> : null}
          {canManage ? <TabsTrigger value="diary">Diary</TabsTrigger> : null}
          {canManage ? <TabsTrigger value="activity">Activity</TabsTrigger> : null}
          <TabsTrigger value="judy">Judy AI</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Trade Milestones</CardTitle>
              </CardHeader>
              <CardContent>
                <TradeMilestoneChecklist canManage={canManage} milestones={tradeMilestoneRows} tradeId={trade.id} />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Trade Details</CardTitle>
                {canEdit ? (
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

            {canViewFinancials ? (
              <>
                <ExchangeRatesCard
                  canManage={canManage}
                  initialRates={exchangeRateRows}
                  tradeId={trade.id}
                  workingExchangeRate={trade.working_exchange_rate}
                />

                <TradePnlCard
                  absorbedDevCostCad={absorbedDevCostCad}
                  absorbedDevCostRmb={absorbedDevCostRmb}
                  absorbedDevCostUsd={absorbedDevCostUsd}
                  costRmb={costRmb}
                  depositPnl={depositPnl}
                  depositRateValue={depositRate?.rate_rmb_per_usd ?? null}
                  finalPnl={finalPnl}
                  finalRateValue={finalRate?.rate_rmb_per_usd ?? null}
                  revenueUsd={revenueUsd}
                  workingPnl={workingPnl}
                  workingRateValue={trade.working_exchange_rate}
                />
              </>
            ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="development">
          <DevelopmentTab
            availableProducts={activeProductOptions}
            canManage={canEdit}
            devCosts={developmentCosts}
            devVersions={developmentVersions}
            tradeId={trade.id}
          />
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
          <ClientQuotationsTab
            canManage={canEdit}
            initialSessions={quotationSessionRows}
            tradeId={trade.id}
            workingExchangeRate={trade.working_exchange_rate}
          />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab
            canManage={canManage}
            initialInvoices={clientInvoiceRows}
            initialSupplierInvoices={supplierInvoiceOutgoingRows}
            initialVendorOutgoingInvoices={vendorOutgoingInvoiceRows}
            orderNumber={trade.order_number ?? trade.trade_id}
            suppliers={activeSupplierOptions}
            tradeId={trade.id}
            vendors={activeVendorOptions}
            workingExchangeRate={trade.working_exchange_rate ?? null}
          />
        </TabsContent>
        {canManage ? (
          <TabsContent value="packing">
            <PackingTab canManage={canManage} initialPlan={normalizedPackingPlan} tradeId={trade.id} />
          </TabsContent>
        ) : null}
        {canViewFinancials ? (
          <TabsContent value="financial">
            <FinancialTab
              book={shareholderBookData}
              canManage={canManage}
              clientInvoices={clientInvoiceRows}
              supplierInvoices={supplierInvoiceOutgoingRows}
              tradeExpenses={tradeExpenseRows}
              tradeId={trade.id}
              workingExchangeRate={trade.working_exchange_rate}
            />
          </TabsContent>
        ) : null}
        <TabsContent value="documents">
          <DocumentsTab initialDocuments={tradeDocumentRows} tradeCode={trade.trade_id} tradeId={trade.id} />
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

        {canManage ? (
          <TabsContent value="shareholders">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Project Partners</CardTitle>
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
              availableUsers={partnerOptions}
              availableVendors={activeVendorOptions}
              canManage={canManage}
              initialShareholders={tradeShareholderRows}
              tradeId={trade.id}
            />
            <VendorInvoicesCard
              canManage={canManage}
              existingInvoices={shareholderVendorInvoiceRows}
              shareholders={tradeShareholderRows}
              tradeId={trade.id}
            />
          </TabsContent>
        ) : null}
        {canManage ? (
          <TabsContent value="activity">
            <ActivityLogTable tradeId={trade.id} />
          </TabsContent>
        ) : null}
        {canManage ? (
          <TabsContent value="diary">
            <DiaryTab canManage={canManage} entries={diaryEntryRows} tradeId={trade.id} />
          </TabsContent>
        ) : null}
        <TabsContent value="judy">
          <JudyChat tradeId={trade.id} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
