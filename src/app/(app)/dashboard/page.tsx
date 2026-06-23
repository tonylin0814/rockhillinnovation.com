import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

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

function formatRmb(value: number) {
  return `\u00A5${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value)}`;
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

type TradeStatus = "draft" | "active" | "settled" | "archived";

const STATUS_CLASSES: Record<TradeStatus, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700",
  archived: "border-red-200 bg-red-50 text-red-700",
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  settled: "border-green-200 bg-green-50 text-green-700",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = createServerSupabaseClient();
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [
    { count: openTradesCount },
    { count: pendingSessionsCount },
    { data: sentClientInvoices },
    { data: unpaidSupplierInvoices },
    { count: settledThisYearCount },
    { data: confirmedBooks },
    { data: recentTrades },
  ] = await Promise.all([
    supabase.from("trades").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("supplier_quote_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    supabase.from("client_invoices").select("total_usd").eq("status", "sent"),
    supabase.from("supplier_invoices_outgoing").select("total_rmb").in("status", ["draft", "sent"]),
    supabase
      .from("trades")
      .select("id", { count: "exact", head: true })
      .eq("status", "settled")
      .gte("updated_at", yearStart),
    supabase.from("shareholder_book").select("net_profit_usd").eq("status", "confirmed"),
    supabase
      .from("trades")
      .select("id, trade_id, status, updated_at, client:clients(id, name)")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const outstandingUsd = roundMoney(
    (sentClientInvoices ?? []).reduce((sum, invoice) => sum + Number(invoice.total_usd ?? 0), 0)
  );
  const owedRmb = roundMoney(
    (unpaidSupplierInvoices ?? []).reduce((sum, invoice) => sum + Number(invoice.total_rmb ?? 0), 0)
  );
  const confirmedNetProfit = roundMoney(
    (confirmedBooks ?? []).reduce((sum, book) => sum + Number(book.net_profit_usd ?? 0), 0)
  );

  const stats = [
    {
      icon: ArrowLeftRight,
      label: "Open Trades",
      value: String(openTradesCount ?? 0),
    },
    {
      icon: ClipboardCheck,
      label: "Pending Quote Sessions",
      value: String(pendingSessionsCount ?? 0),
    },
    {
      icon: TrendingUp,
      label: "Outstanding from Clients",
      value: formatUsd(outstandingUsd),
    },
    {
      icon: TrendingDown,
      label: "Owed to Suppliers",
      value: formatRmb(owedRmb),
    },
    {
      icon: CheckCircle2,
      label: "Settled This Year",
      value: String(settledThisYearCount ?? 0),
    },
    {
      icon: DollarSign,
      label: "Net Profit (Confirmed)",
      value: formatUsd(confirmedNetProfit),
    },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0d1b34]">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">
          {getGreeting()}, {user?.name ?? "there"}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card className="border-slate-200 shadow-sm" key={stat.label}>
              <CardContent className="relative p-6">
                <Icon className="absolute right-5 top-5 h-5 w-5 text-slate-300" />
                <p className="pr-8 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                <p className="mt-4 text-3xl font-semibold text-[#0d1b34]">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Trades</CardTitle>
          <Link className="text-sm font-medium text-[#0d1b34] underline-offset-4 hover:underline" href="/trades">
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentTrades?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTrades.map((trade) => {
                  const client = Array.isArray(trade.client) ? trade.client[0] : trade.client;
                  const status = trade.status as TradeStatus;

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
                      <TableCell className="text-sm text-slate-500">{formatDate(trade.updated_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 py-10 text-sm text-slate-500">No trades yet.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
