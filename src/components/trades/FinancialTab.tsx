"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClientInvoice, ShareholderBook, SupplierInvoiceOutgoing, TradeExpense } from "@/types";
import { ShareholderBookCard } from "./ShareholderBookCard";
import { TradeExpensesCard } from "./TradeExpensesCard";

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

function SummaryRow({
  highlight,
  indent,
  label,
  value,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex justify-between border-b border-slate-100 py-2.5 last:border-0 ${
        indent ? "pl-4" : ""
      } ${highlight ? "font-semibold" : ""}`}
    >
      <span className={`text-sm ${highlight ? "text-[#0d1b34]" : "text-slate-600"}`}>{label}</span>
      <span className={`font-mono text-sm ${highlight ? "text-[#0d1b34]" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}

export function FinancialTab({
  book,
  canManage,
  clientInvoices,
  supplierInvoices,
  tradeExpenses,
  tradeId,
  workingExchangeRate,
}: {
  tradeId: string;
  canManage: boolean;
  clientInvoices: ClientInvoice[];
  supplierInvoices: SupplierInvoiceOutgoing[];
  tradeExpenses: TradeExpense[];
  book: ShareholderBook | null;
  workingExchangeRate: number | null;
}) {
  const totalRevenue = clientInvoices.reduce((sum, invoice) => sum + Number(invoice.total_usd ?? 0), 0);
  const totalCost = supplierInvoices.reduce((sum, invoice) => {
    if (invoice.total_usd != null) {
      return sum + Number(invoice.total_usd);
    }

    if (workingExchangeRate && invoice.total_rmb) {
      return sum + Number(invoice.total_rmb) / workingExchangeRate;
    }

    return sum;
  }, 0);
  const totalExpenses = tradeExpenses.reduce((sum, expense) => sum + Number(expense.amount_usd ?? 0), 0);
  const grossProfit = totalRevenue - totalCost;
  const taxableBase = grossProfit - totalExpenses;

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Revenue - Client Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clientInvoices.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-sm">{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell className="text-sm capitalize">{invoice.status}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatUsd(Number(invoice.total_usd ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end border-t border-slate-200 px-4 py-3">
                <span className="text-sm font-semibold text-[#0d1b34]">Total: {formatUsd(totalRevenue)}</span>
              </div>
            </>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No client invoices yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Cost - Supplier Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {supplierInvoices.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total (RMB)</TableHead>
                    <TableHead className="text-right">Total (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierInvoices.map((invoice) => {
                    const usd =
                      invoice.total_usd != null
                        ? Number(invoice.total_usd)
                        : workingExchangeRate
                          ? Number(invoice.total_rmb) / workingExchangeRate
                          : null;

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                        <TableCell className="text-sm">{formatDate(invoice.invoice_date)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ¥
                          {Number(invoice.total_rmb).toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {usd != null ? formatUsd(usd) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex justify-end border-t border-slate-200 px-4 py-3">
                <span className="text-sm font-semibold text-[#0d1b34]">
                  Total: {workingExchangeRate ? formatUsd(totalCost) : "Set exchange rate to calculate"}
                </span>
              </div>
            </>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No supplier invoices yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <TradeExpensesCard canManage={canManage} initialExpenses={tradeExpenses} tradeId={tradeId} />
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Profit Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 px-4 py-1">
            <SummaryRow label="Gross Revenue" value={formatUsd(totalRevenue)} />
            <SummaryRow label="Supplier Cost" value={`(${formatUsd(totalCost)})`} />
            <SummaryRow highlight label="Gross Profit" value={formatUsd(grossProfit)} />
            <SummaryRow indent label="Trade Expenses" value={`(${formatUsd(totalExpenses)})`} />
            <SummaryRow highlight label="Taxable Base" value={formatUsd(taxableBase)} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Tax and per-shareholder breakdown are calculated in the Profit Book below once shareholders are configured.
          </p>
        </CardContent>
      </Card>

      <ShareholderBookCard book={book} canManage={canManage} tradeId={tradeId} />
    </div>
  );
}
