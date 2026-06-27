"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/context/LanguageContext";
import type { Trade } from "@/types";

type StatusFilter = "all" | Trade["status"];

const statusClasses: Record<Trade["status"], string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  active: "border-blue-200 bg-blue-50 text-blue-700",
  settled: "border-green-200 bg-green-50 text-green-700",
  archived: "border-red-200 bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: Trade["status"] }) {
  const { t } = useLanguage();

  return (
    <Badge className={statusClasses[status]} variant="outline">
      {t.status[status] ?? status}
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
  return typeof rate === "number" ? `¥${rate.toFixed(4)}` : "-";
}

export function TradesTable({ trades }: { trades: Trade[] }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredTrades = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return trades.filter((trade) => {
      const matchesStatus = statusFilter === "all" || trade.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        trade.trade_id.toLowerCase().includes(normalizedSearch) ||
        (trade.client?.code ?? "").toLowerCase().includes(normalizedSearch) ||
        (trade.order_number ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, trades]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          className="sm:max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.trades.searchPlaceholder}
          value={search}
        />
        <Select onValueChange={(value: StatusFilter) => setStatusFilter(value)} value={statusFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder={t.trades.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            <SelectItem value="draft">{t.status.draft}</SelectItem>
            <SelectItem value="active">{t.status.active}</SelectItem>
            <SelectItem value="settled">{t.status.settled}</SelectItem>
            <SelectItem value="archived">{t.status.archived}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.trades.tradeId}</TableHead>
            <TableHead>{t.trades.client}</TableHead>
            <TableHead>{t.trades.orderNumber}</TableHead>
            <TableHead>{t.table.date}</TableHead>
            <TableHead>{t.trades.status}</TableHead>
            <TableHead>{t.trades.rate}</TableHead>
            <TableHead className="text-right">{t.table.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTrades.length ? (
            filteredTrades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell>
                  <Link
                    className="font-mono text-sm font-semibold text-[#0d1b34] transition-colors hover:text-blue-700"
                    href={`/trades/${trade.id}`}
                  >
                    {trade.trade_id}
                  </Link>
                </TableCell>
                <TableCell>
                  {trade.client ? (
                    <span>
                      <span className="font-medium text-[#0d1b34]">{trade.client.code}</span>
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{trade.order_number ?? "-"}</TableCell>
                <TableCell>{formatDate(trade.trade_date)}</TableCell>
                <TableCell>
                  <StatusBadge status={trade.status} />
                </TableCell>
                <TableCell>{formatRate(trade.working_exchange_rate)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/trades/${trade.id}`}>{t.trades.open}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={7}>
                {t.trades.noTrades}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
