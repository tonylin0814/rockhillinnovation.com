"use client";

import { Download, Loader2, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { generatePayoutInvoice, updatePayoutStatus } from "@/app/actions/payout-invoices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/context/LanguageContext";
import type { PayoutInvoice } from "@/types";

export type PayoutShareholder = {
  id: string;
  person_name: string;
  split_pct: number;
  user_id: string | null;
};

export type PayoutBookLine = {
  id: string;
  trade_shareholder_id: string | null;
  person_name: string;
  split_pct: number;
  net_share_usd: number;
};

export type PayoutBook = {
  net_profit_usd: number | null;
  status: string;
  lines: PayoutBookLine[] | null;
} | null;

export type PayoutTrade = {
  id: string;
  trade_id: string;
  trade_date: string | null;
  status: string;
  shareholders: PayoutShareholder[];
  book: PayoutBook | PayoutBook[];
};

function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function usd(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function resolveDividend(shareholder: PayoutShareholder, book: PayoutBook) {
  if (!book) return null;
  const lines = normalizeArray(book.lines);
  const line = lines.find((item) => item.trade_shareholder_id === shareholder.id);
  if (line) return Number(line.net_share_usd);
  const netProfit = Number(book.net_profit_usd ?? 0);
  if (!netProfit) return null;
  return Math.round(((netProfit * Number(shareholder.split_pct)) / 100) * 100) / 100;
}

function StatusBadge({ status }: { status: PayoutInvoice["status"] }) {
  const { t } = useLanguage();
  const isPaid = status === "paid";

  return (
    <Badge
      className={isPaid ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}
      variant="outline"
    >
      {isPaid ? t.payout.paid : t.payout.outstanding}
    </Badge>
  );
}

function PayoutActions({
  canEdit,
  invoice,
  shareholder,
  trade,
}: {
  canEdit: boolean;
  invoice: PayoutInvoice | null;
  shareholder: PayoutShareholder;
  trade: PayoutTrade;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const status = invoice?.status ?? "outstanding";

  if (!canEdit) return null;

  function generate() {
    setPendingKey(`generate-${shareholder.id}`);
    startTransition(async () => {
      const result = await generatePayoutInvoice(trade.id, shareholder.id);
      setPendingKey(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Payout invoice generated");
      router.refresh();
    });
  }

  function setStatus(nextStatus: PayoutInvoice["status"]) {
    if (!invoice) return;
    setPendingKey(`${invoice.id}-${nextStatus}`);
    startTransition(async () => {
      const result = await updatePayoutStatus(invoice.id, nextStatus);
      setPendingKey(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Payout status updated");
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-2">
      {!invoice ? (
        <Button disabled={isPending} onClick={generate} size="sm" type="button">
          {pendingKey === `generate-${shareholder.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {pendingKey === `generate-${shareholder.id}` ? t.payout.generating : t.payout.generateInvoice}
        </Button>
      ) : null}
      {invoice ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={isPending} size="sm" type="button" variant="outline">
              <MoreHorizontal className="mr-2 h-4 w-4" />
              {t.payout.actions}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={status === "outstanding"} onClick={() => setStatus("outstanding")}>
              {t.payout.markOutstanding}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={status === "paid"} onClick={() => setStatus("paid")}>
              {t.payout.markPaid}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function PayoutPage({
  canEdit,
  payoutInvoices,
  trades,
}: {
  canEdit: boolean;
  payoutInvoices: PayoutInvoice[];
  trades: PayoutTrade[];
}) {
  const { t } = useLanguage();
  const normalizedTrades = trades.map((trade) => ({
    ...trade,
    book: normalizeOne(trade.book),
    shareholders: normalizeArray(trade.shareholders),
  }));

  if (!normalizedTrades.length) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-8 text-sm text-slate-500">{t.payout.noData}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold text-[#0d1b34]">{t.payout.title}</h1>
        <p className="mt-1 text-sm text-slate-500">Profit distribution invoices and payout status by trade.</p>
      </div>

      {normalizedTrades.map((trade) => {
        const netProfit = trade.book ? Number(trade.book.net_profit_usd ?? 0) : null;

        return (
          <Card className="border-slate-200 shadow-sm" key={trade.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle className="text-base text-[#0d1b34]">
                {t.payout.tradeNumber}: {trade.trade_id}
              </CardTitle>
              <div className="text-sm">
                <span className="font-medium text-slate-500">{t.payout.netProfit}: </span>
                <span className="font-semibold text-[#0d1b34]">{usd(netProfit)}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.payout.partner}</TableHead>
                    <TableHead className="text-right">{t.payout.dividend}</TableHead>
                    <TableHead>{t.payout.invoice}</TableHead>
                    <TableHead>{t.payout.status}</TableHead>
                    <TableHead>{t.payout.date}</TableHead>
                    {canEdit ? <TableHead className="text-right">{t.payout.actions}</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trade.shareholders.map((shareholder) => {
                    const invoice =
                      payoutInvoices.find(
                        (item) => item.trade_id === trade.id && item.trade_shareholder_id === shareholder.id
                      ) ?? null;
                    const status = invoice?.status ?? "outstanding";
                    const dividend = invoice ? Number(invoice.dividend_usd) : resolveDividend(shareholder, trade.book);

                    return (
                      <TableRow key={shareholder.id}>
                        <TableCell className="font-medium text-[#0d1b34]">{shareholder.person_name}</TableCell>
                        <TableCell className="text-right">{usd(dividend)}</TableCell>
                        <TableCell>
                          {invoice?.invoice_url ? (
                            <Button asChild size="sm" variant="outline">
                              <a href={invoice.invoice_url} rel="noreferrer" target="_blank">
                                <Download className="mr-2 h-4 w-4" />
                                {t.payout.download}
                              </a>
                            </Button>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={status} />
                        </TableCell>
                        <TableCell>{formatDate(invoice?.status_changed_at ?? null)}</TableCell>
                        {canEdit ? (
                          <TableCell>
                            <PayoutActions canEdit={canEdit} invoice={invoice} shareholder={shareholder} trade={trade} />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
