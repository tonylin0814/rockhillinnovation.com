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

      toast.success("Book calculated");
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

      toast.success("Book confirmed");
      router.refresh();
    });
  }

  const lines = book?.lines ?? [];
  const isPending = isCalculating || isConfirming;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CardTitle>Profit Book</CardTitle>
          {book ? (
            <Badge
              className={
                book.status === "confirmed"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }
              variant="outline"
            >
              {book.status === "confirmed" ? "Confirmed" : "Draft"}
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
                {isCalculating ? "Calculating..." : book ? "Recalculate" : "Calculate Book"}
              </Button>
            ) : null}
            {book?.status === "draft" ? (
              <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={handleConfirm}>
                {isConfirming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {isConfirming ? "Confirming..." : "Confirm"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {!book ? (
          <p className="text-sm text-slate-500">
            No calculation yet. {canManage ? 'Click "Calculate Book" to run the first calculation.' : ""}
          </p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Summary - as of {formatDate(book.calculated_at)}
              </p>
              <div className="rounded-lg border border-slate-200 px-4 py-1">
                <SummaryRow label="Gross Profit" value={formatUsd(book.gross_profit_usd)} />
                <SummaryRow label="Expense Deductions" value={`(${formatUsd(book.expense_deductions_usd)})`} />
                <SummaryRow label="Taxable Base" value={formatUsd(book.taxable_base_usd)} />
                <SummaryRow
                  label={`Corporate Tax (${formatPct(Number(book.corporate_tax_rate) * 100)})`}
                  value={`(${formatUsd(book.corporate_tax_usd)})`}
                />
                <SummaryRow highlight label="Net Profit" value={formatUsd(book.net_profit_usd)} />
                <SummaryRow label="Per 1% Share" value={formatUsd(book.per_share_usd)} />
              </div>
            </div>

            {lines.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Distribution</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead className="text-right">Split %</TableHead>
                      <TableHead className="text-right">Gross Share</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Net Share</TableHead>
                      <TableHead>Invoiced Through</TableHead>
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
                      <TableCell className="font-semibold">Total</TableCell>
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
