"use client";

import { ArrowLeftRight, CheckCircle2, DollarSign, Percent as PercentIcon, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PeriodToggle } from "@/components/dashboard/PeriodToggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/context/LanguageContext";

type TradeStatus = "draft" | "active" | "settled" | "archived";

export type DashboardTradeRow = {
  id: string;
  trade_id: string;
  trade_date: string | null;
  status: TradeStatus;
  clientName: string | null;
};

type DashboardContentProps = {
  isYearFilter: boolean;
  totalDividends: number;
  totalCost: number;
  totalMargin: number;
  totalProfit: number;
  totalSale: number;
  totalTrades: number;
  tradeRows: DashboardTradeRow[];
  userName: string;
};

const STATUS_CLASSES: Record<TradeStatus, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700",
  archived: "border-red-200 bg-red-50 text-red-700",
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  settled: "border-green-200 bg-green-50 text-green-700",
};

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "goodMorning";
  if (hour < 17) return "goodAfternoon";
  return "goodEvening";
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

export function DashboardContent({
  isYearFilter,
  totalDividends,
  totalCost,
  totalMargin,
  totalProfit,
  totalSale,
  totalTrades,
  tradeRows,
  userName,
}: DashboardContentProps) {
  const { t } = useLanguage();
  const greetingKey = getGreeting();

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0d1b34]">{t.dashboard.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t.dashboard[greetingKey]}, {userName}.
          </p>
        </div>
        <Suspense fallback={<div className="h-9 w-40 rounded-lg bg-slate-100" />}>
          <PeriodToggle />
        </Suspense>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={ArrowLeftRight} label={t.dashboard.totalTrades} value={String(totalTrades)} />
        <StatCard icon={TrendingUp} label={t.dashboard.totalSale} value={formatUsd(totalSale)} />
        <StatCard icon={TrendingDown} label={t.dashboard.totalCost} value={formatUsd(totalCost)} />
        <StatCard icon={DollarSign} label={t.dashboard.totalProfit} value={formatUsd(totalProfit)} />
        <StatCard icon={PercentIcon} label={t.dashboard.totalMargin} value={`${totalMargin.toFixed(1)}%`} />
        <StatCard icon={CheckCircle2} label={t.dashboard.totalDividends} value={formatUsd(totalDividends)} />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t.dashboard.myTrades}</CardTitle>
          <Link className="text-sm font-medium text-[#0d1b34] underline-offset-4 hover:underline" href="/trades">
            {t.dashboard.viewAll}
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {tradeRows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.trades.tradeId}</TableHead>
                  <TableHead>{t.trades.client}</TableHead>
                  <TableHead>{t.trades.status}</TableHead>
                  <TableHead>{t.trades.tradeDate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tradeRows.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>
                      <Link
                        className="font-mono text-sm font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                        href={`/trades/${trade.id}`}
                      >
                        {trade.trade_id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{trade.clientName ?? "-"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_CLASSES[trade.status] ?? STATUS_CLASSES.draft} variant="outline">
                        {t.status[trade.status] ?? trade.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {trade.trade_date ? formatDate(trade.trade_date) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 py-10 text-sm text-slate-500">
              {isYearFilter ? t.dashboard.noTradesYear : t.dashboard.noTrades}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
