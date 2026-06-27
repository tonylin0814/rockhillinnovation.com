"use client";

import { Calculator, CheckCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { calculateShareholderBook, confirmShareholderBook } from "@/app/actions/shareholder-book";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/context/LanguageContext";
import type { ShareholderBook } from "@/types";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function formatPct(value: number) {
  return `${Number(value).toFixed(2)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function SummaryRow({ highlight, label, value }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`flex justify-between border-b border-slate-100 py-2 last:border-0 ${
        highlight ? "font-semibold text-[#0d1b34]" : ""
      }`}
    >
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm ${highlight ? "text-base font-semibold text-[#0d1b34]" : ""}`}>{value}</span>
    </div>
  );
}

export function ShareholderBookCard({
  book,
  canManage,
  tradeId,
}: {
  tradeId: string;
  book: ShareholderBook | null;
  canManage: boolean;
}) {
  const { language } = useLanguage();
  const text = language === "zh"
    ? {
        bookCalculated: "利潤簿已計算",
        bookConfirmed: "利潤簿已確認",
        calculateBook: "計算利潤簿",
        calculating: "計算中...",
        confirm: "確認",
        confirmed: "已確認",
        confirming: "確認中...",
        corporateTax: "營利事業所得稅",
        distribution: "分配明細",
        draft: "草稿",
        expenseDeductions: "費用扣除",
        grossProfit: "毛利",
        grossShare: "毛利分配",
        invoicedThrough: "開票公司",
        netProfit: "淨利",
        netShare: "淨額分配",
        noCalculation: "尚未計算。",
        noCalculationHelp: "點擊「計算利潤簿」執行第一次計算。",
        perShare: "每 1% 分配",
        person: "人員",
        profitBook: "利潤簿",
        recalculate: "重新計算",
        splitPct: "分成 %",
        summaryAsOf: "摘要 - 截至",
        tax: "稅額",
        taxableBase: "應稅基礎",
        total: "合計",
      }
    : {
        bookCalculated: "Book calculated",
        bookConfirmed: "Book confirmed",
        calculateBook: "Calculate Book",
        calculating: "Calculating...",
        confirm: "Confirm",
        confirmed: "Confirmed",
        confirming: "Confirming...",
        corporateTax: "Corporate Tax",
        distribution: "Distribution",
        draft: "Draft",
        expenseDeductions: "Expense Deductions",
        grossProfit: "Gross Profit",
        grossShare: "Gross Share",
        invoicedThrough: "Invoiced Through",
        netProfit: "Net Profit",
        netShare: "Net Share",
        noCalculation: "No calculation yet.",
        noCalculationHelp: 'Click "Calculate Book" to run the first calculation.',
        perShare: "Per 1% Share",
        person: "Person",
        profitBook: "Profit Book",
        recalculate: "Recalculate",
        splitPct: "Split %",
        summaryAsOf: "Summary - as of",
        tax: "Tax",
        taxableBase: "Taxable Base",
        total: "Total",
      };
  const router = useRouter();
  const [isCalculating, startCalculate] = useTransition();
  const [isConfirming, startConfirm] = useTransition();

  function handleCalculate() {
    startCalculate(async () => {
      const result = await calculateShareholderBook(tradeId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(text.bookCalculated);
      router.refresh();
    });
  }

  function handleConfirm() {
    if (!book) {
      return;
    }

    startConfirm(async () => {
      const result = await confirmShareholderBook(book.id, tradeId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(text.bookConfirmed);
      router.refresh();
    });
  }

  const lines = book?.lines ?? [];
  const isPending = isCalculating || isConfirming;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CardTitle>{text.profitBook}</CardTitle>
          {book ? (
            <Badge
              className={
                book.status === "confirmed"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }
              variant="outline"
            >
              {book.status === "confirmed" ? text.confirmed : text.draft}
            </Badge>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex gap-2">
            {book?.status !== "confirmed" ? (
              <Button disabled={isPending} onClick={handleCalculate} variant="outline">
                {isCalculating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="mr-2 h-4 w-4" />
                )}
                {isCalculating ? text.calculating : book ? text.recalculate : text.calculateBook}
              </Button>
            ) : null}
            {book?.status === "draft" ? (
              <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={handleConfirm}>
                {isConfirming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {isConfirming ? text.confirming : text.confirm}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {!book ? (
          <p className="text-sm text-slate-500">
            {text.noCalculation} {canManage ? text.noCalculationHelp : ""}
          </p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {text.summaryAsOf} {formatDate(book.calculated_at)}
              </p>
              <div className="rounded-lg border border-slate-200 px-4 py-1">
                <SummaryRow label={text.grossProfit} value={formatUsd(book.gross_profit_usd)} />
                <SummaryRow label={text.expenseDeductions} value={`(${formatUsd(book.expense_deductions_usd)})`} />
                <SummaryRow label={text.taxableBase} value={formatUsd(book.taxable_base_usd)} />
                <SummaryRow
                  label={`${text.corporateTax} (${formatPct(Number(book.corporate_tax_rate) * 100)})`}
                  value={`(${formatUsd(book.corporate_tax_usd)})`}
                />
                <SummaryRow highlight label={text.netProfit} value={formatUsd(book.net_profit_usd)} />
                <SummaryRow label={text.perShare} value={formatUsd(book.per_share_usd)} />
              </div>
            </div>

            {lines.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{text.distribution}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{text.person}</TableHead>
                      <TableHead className="text-right">{text.splitPct}</TableHead>
                      <TableHead className="text-right">{text.grossShare}</TableHead>
                      <TableHead className="text-right">{text.tax}</TableHead>
                      <TableHead className="text-right">{text.netShare}</TableHead>
                      <TableHead>{text.invoicedThrough}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">{line.person_name}</TableCell>
                        <TableCell className="text-right">{formatPct(line.split_pct)}</TableCell>
                        <TableCell className="text-right">{formatUsd(line.gross_share_usd)}</TableCell>
                        <TableCell className="text-right text-slate-500">
                          ({formatUsd(line.tax_contribution_usd)})
                        </TableCell>
                        <TableCell className="text-right font-semibold text-[#0d1b34]">
                          {formatUsd(line.net_share_usd)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">{line.invoiced_through ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">{text.total}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatPct(lines.reduce((sum, line) => sum + Number(line.split_pct), 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatUsd(lines.reduce((sum, line) => sum + Number(line.gross_share_usd), 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-500">
                        ({formatUsd(lines.reduce((sum, line) => sum + Number(line.tax_contribution_usd), 0))})
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[#0d1b34]">
                        {formatUsd(lines.reduce((sum, line) => sum + Number(line.net_share_usd), 0))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
