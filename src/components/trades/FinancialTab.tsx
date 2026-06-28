"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/context/LanguageContext";
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
  const { language, t } = useLanguage();
  const text = language === "zh"
    ? {
        costSupplierInvoices: "成本 - 供應商發票",
        date: "日期",
        expenses: "費用",
        grossProfit: "毛利",
        grossRevenue: "總收入",
        invoiceNo: "發票號碼",
        noClientInvoices: "尚無客戶發票。",
        noSupplierInvoices: "尚無供應商發票。",
        profitSummary: "利潤摘要",
        revenueClientInvoices: "收入 - 客戶發票",
        setRate: "設定匯率後計算",
        status: "狀態",
        supplierCost: "供應商成本",
        taxableBase: "應稅基礎",
        taxHelp: "稅務與各股東分配會在下方利潤簿中依股東設定計算。",
        total: "合計",
        totalRmb: "合計（人民幣）",
        totalUsd: "合計（美元）",
        tradeExpenses: "交易費用",
      }
    : {
        costSupplierInvoices: "Cost - Supplier Invoices",
        date: "Date",
        expenses: "Expenses",
        grossProfit: "Gross Profit",
        grossRevenue: "Gross Revenue",
        invoiceNo: "Invoice #",
        noClientInvoices: "No client invoices yet.",
        noSupplierInvoices: "No supplier invoices yet.",
        profitSummary: "Profit Summary",
        revenueClientInvoices: "Revenue - Client Invoices",
        setRate: "Set exchange rate to calculate",
        status: "Status",
        supplierCost: "Supplier Cost",
        taxableBase: "Taxable Base",
        taxHelp: "Tax and per-shareholder breakdown are calculated in the Profit Book below once shareholders are configured.",
        total: "Total",
        totalRmb: "Total (RMB)",
        totalUsd: "Total (USD)",
        tradeExpenses: "Trade Expenses",
      };
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
  const totalExpenses = tradeExpenses.reduce((sum, expense) => {
    if (
      expense.category === "reimbursement_tony" ||
      expense.category === "reimbursement_michael" ||
      expense.category === "reimbursement_amish"
    ) {
      return sum;
    }

    return sum + Number(expense.amount_usd ?? 0);
  }, 0);
  const grossProfit = totalRevenue - totalCost;
  const taxableBase = grossProfit - totalExpenses;

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{text.revenueClientInvoices}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clientInvoices.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{text.invoiceNo}</TableHead>
                    <TableHead>{text.date}</TableHead>
                    <TableHead>{text.status}</TableHead>
                    <TableHead className="text-right">{text.totalUsd}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-sm">{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell className="text-sm capitalize">{t.status[invoice.status as keyof typeof t.status] ?? invoice.status}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatUsd(Number(invoice.total_usd ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end border-t border-slate-200 px-4 py-3">
                <span className="text-sm font-semibold text-[#0d1b34]">{text.total}: {formatUsd(totalRevenue)}</span>
              </div>
            </>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-slate-500">{text.noClientInvoices}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{text.costSupplierInvoices}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {supplierInvoices.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{text.invoiceNo}</TableHead>
                    <TableHead>{text.date}</TableHead>
                    <TableHead className="text-right">{text.totalRmb}</TableHead>
                    <TableHead className="text-right">{text.totalUsd}</TableHead>
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
                  {text.total}: {workingExchangeRate ? formatUsd(totalCost) : text.setRate}
                </span>
              </div>
            </>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-slate-500">{text.noSupplierInvoices}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{text.expenses}</CardTitle>
        </CardHeader>
        <CardContent>
          <TradeExpensesCard canManage={canManage} initialExpenses={tradeExpenses} tradeId={tradeId} />
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{text.profitSummary}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 px-4 py-1">
            <SummaryRow label={text.grossRevenue} value={formatUsd(totalRevenue)} />
            <SummaryRow label={text.supplierCost} value={`(${formatUsd(totalCost)})`} />
            <SummaryRow highlight label={text.grossProfit} value={formatUsd(grossProfit)} />
            <SummaryRow indent label={text.tradeExpenses} value={`(${formatUsd(totalExpenses)})`} />
            <SummaryRow highlight label={text.taxableBase} value={formatUsd(taxableBase)} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {text.taxHelp}
          </p>
        </CardContent>
      </Card>

      <ShareholderBookCard book={book} canManage={canManage} tradeId={tradeId} />
    </div>
  );
}
