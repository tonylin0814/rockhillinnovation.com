import { ArrowLeftRight, CheckCircle2, DollarSign, Percent as PercentIcon, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PeriodToggle } from "@/components/dashboard/PeriodToggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getGreeting() {
  const hour = new Date().getUTCHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(rows: Array<Record<string, unknown>>, field: string) {
  return roundMoney((rows ?? []).reduce((acc, row) => acc + Number(row[field] ?? 0), 0));
}

type TradeStatus = "draft" | "active" | "settled" | "archived";

type TradeRow = {
  id: string;
  trade_id: string;
  trade_date: string | null;
  status: TradeStatus;
  client?: { name: string | null } | { name: string | null }[] | null;
};

const STATUS_CLASSES: Record<TradeStatus, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700",
  archived: "border-red-200 bg-red-50 text-red-700",
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  settled: "border-green-200 bg-green-50 text-green-700",
};

function ErrorMessage({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{message}</div>;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="relative p-6">
        <Icon className="absolute right-5 top-5 h-5 w-5 text-slate-300" />
        <p className="pr-8 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-4 text-3xl font-semibold text-[#0d1b34]">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "user") {
    redirect("/trades");
  }

  const supabase = createServerSupabaseClient();
  const isYearFilter = (searchParams.period ?? "year") !== "all";
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const { data: participantRows, error: participantError } = await supabase
    .from("trade_participants")
    .select("trade_id")
    .eq("user_id", user.id);

  if (participantError) {
    return <ErrorMessage message={participantError.message} />;
  }

  const allTradeIds = (participantRows ?? []).map((row) => row.trade_id);
  let tradeIds = allTradeIds;

  if (isYearFilter && allTradeIds.length) {
    const { data: yearTrades, error: yearTradesError } = await supabase
      .from("trades")
      .select("id")
      .in("id", allTradeIds)
      .gte("trade_date", yearStart);

    if (yearTradesError) {
      return <ErrorMessage message={yearTradesError.message} />;
    }

    tradeIds = (yearTrades ?? []).map((trade) => trade.id);
  }

  let tradeRows: TradeRow[] = [];
  let clientInvoices: Array<Record<string, unknown>> = [];
  let supplierInvoices: Array<Record<string, unknown>> = [];
  let vendorInvoices: Array<Record<string, unknown>> = [];
  let tradeExpenses: Array<Record<string, unknown>> = [];
  let confirmedBooks: Array<Record<string, unknown>> = [];
  let dividendLines: Array<Record<string, unknown>> = [];

  if (tradeIds.length) {
    const [
      tradeResult,
      clientInvoiceResult,
      supplierInvoiceResult,
      vendorInvoiceResult,
      tradeExpenseResult,
      confirmedBookResult,
      dividendLineResult,
    ] = await Promise.all([
      supabase
        .from("trades")
        .select("id, trade_id, trade_date, status, client:clients(name)")
        .in("id", tradeIds)
        .order("trade_date", { ascending: false }),
      supabase.from("client_invoices").select("total_usd").in("trade_id", tradeIds),
      supabase.from("supplier_invoices_outgoing").select("total_usd").in("trade_id", tradeIds),
      supabase.from("expense_vendor_invoices").select("amount_usd").in("trade_id", tradeIds),
      supabase.from("trade_expenses").select("amount_usd").in("trade_id", tradeIds),
      supabase.from("shareholder_book").select("net_profit_usd, corporate_tax_usd").in("trade_id", tradeIds).eq("status", "confirmed"),
      supabase
        .from("shareholder_book_lines")
        .select("net_share_usd, book:shareholder_book!inner(trade_id, status)")
        .eq("book.status", "confirmed")
        .in("book.trade_id", tradeIds)
        .eq("person_name", user.name),
    ]);

    const firstError =
      tradeResult.error ??
      clientInvoiceResult.error ??
      supplierInvoiceResult.error ??
      vendorInvoiceResult.error ??
      tradeExpenseResult.error ??
      confirmedBookResult.error ??
      dividendLineResult.error;

    if (firstError) {
      return <ErrorMessage message={firstError.message} />;
    }

    tradeRows = (tradeResult.data ?? []) as TradeRow[];
    clientInvoices = (clientInvoiceResult.data ?? []) as Array<Record<string, unknown>>;
    supplierInvoices = (supplierInvoiceResult.data ?? []) as Array<Record<string, unknown>>;
    vendorInvoices = (vendorInvoiceResult.data ?? []) as Array<Record<string, unknown>>;
    tradeExpenses = (tradeExpenseResult.data ?? []) as Array<Record<string, unknown>>;
    confirmedBooks = (confirmedBookResult.data ?? []) as Array<Record<string, unknown>>;
    dividendLines = (dividendLineResult.data ?? []) as Array<Record<string, unknown>>;
  }

  const totalTrades = tradeIds.length;
  const totalSale = sum(clientInvoices, "total_usd");
  const supplierCost = sum(supplierInvoices, "total_usd");
  const vendorCost = sum(vendorInvoices, "amount_usd");
  const expenseCost = sum(tradeExpenses, "amount_usd");
  const corporateTax = roundMoney(
    confirmedBooks.reduce((acc, book) => acc + Number(book.corporate_tax_usd ?? 0), 0)
  );
  const totalCost = roundMoney(supplierCost + vendorCost + expenseCost + corporateTax);
  const totalProfit = sum(confirmedBooks, "net_profit_usd");
  const totalMargin = totalSale > 0 ? Math.round((totalProfit / totalSale) * 10000) / 100 : 0;
  const totalDividends = roundMoney(
    dividendLines.reduce((acc, row) => acc + Number(row.net_share_usd ?? 0), 0)
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0d1b34]">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {getGreeting()}, {user.name}.
          </p>
        </div>
        <Suspense fallback={<div className="h-9 w-40 rounded-lg bg-slate-100" />}>
          <PeriodToggle />
        </Suspense>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={ArrowLeftRight} label="Total Trades" value={String(totalTrades)} />
        <StatCard icon={TrendingUp} label="Total Sale" value={formatUsd(totalSale)} />
        <StatCard icon={TrendingDown} label="Total Cost" value={formatUsd(totalCost)} />
        <StatCard icon={DollarSign} label="Total Profit" value={formatUsd(totalProfit)} />
        <StatCard icon={PercentIcon} label="Total Margin" value={`${totalMargin.toFixed(1)}%`} />
        <StatCard icon={CheckCircle2} label="Total Dividends" value={formatUsd(totalDividends)} />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My Trades</CardTitle>
          <Link className="text-sm font-medium text-[#0d1b34] underline-offset-4 hover:underline" href="/trades">
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {tradeRows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trade Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tradeRows.map((trade) => {
                  const client = Array.isArray(trade.client) ? trade.client[0] : trade.client;
                  const status = trade.status;

                  return (
                    <TableRow key={trade.id}>
                      <TableCell>
                        <Link
                          className="font-mono text-sm font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                          href={`/trades/${trade.id}`}
                        >
                          {trade.trade_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{client?.name ?? "-"}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_CLASSES[status] ?? STATUS_CLASSES.draft} variant="outline">
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {trade.trade_date ? formatDate(trade.trade_date) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 py-10 text-sm text-slate-500">
              No trades {isYearFilter ? "this year" : "found"}.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
