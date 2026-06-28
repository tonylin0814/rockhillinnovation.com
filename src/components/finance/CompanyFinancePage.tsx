"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";

import { addShareholderPayout, deleteShareholderPayout } from "@/app/actions/shareholder-payouts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { PayoutInvoice, ShareholderPayout } from "@/types";

type BookLine = {
  id: string;
  trade_shareholder_id: string | null;
  person_name: string;
  split_pct: number;
  gross_share_usd: number;
  tax_contribution_usd: number;
  net_share_usd: number;
};

type Book = {
  id: string;
  gross_profit_usd: number;
  expense_deductions_usd: number;
  taxable_base_usd: number;
  corporate_tax_rate: number;
  corporate_tax_usd: number;
  net_profit_usd: number;
  per_share_usd: number;
  status: string;
  calculated_at: string;
  lines: BookLine[];
} | null;

type SettledTrade = {
  id: string;
  trade_id: string;
  trade_date: string | null;
  status: string;
  client: { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
  book: Book | Book[];
};

type ActiveTrade = {
  id: string;
  trade_id: string;
  trade_date: string | null;
  status: string;
  client: { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
  client_invoices: { total_usd: number | null; status: string }[] | null;
  supplier_invoices_outgoing: { total_usd: number | null; total_rmb: number | null }[] | null;
  trade_expenses: { amount_usd: number }[] | null;
  book: { net_profit_usd: number; corporate_tax_usd: number; status: string } | { net_profit_usd: number; corporate_tax_usd: number; status: string }[] | null;
};

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isTonyName(name: string) {
  const normalized = name.trim().toLowerCase();
  return normalized === "tony" || normalized === "tony lin";
}

function StatCard({
  highlight,
  label,
  sub,
  value,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}>
      <CardContent className="pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${highlight ? "text-emerald-700" : "text-[#0d1b34]"}`}>
          {value}
        </p>
        {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function AddPayoutDialog({ tradeCode, tradeId }: { tradeId: string; tradeCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await addShareholderPayout(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Payout recorded");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={(event) => {
            event.stopPropagation();
            setError(null);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Record Payout
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payout - {tradeCode}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor={`person_name_${tradeId}`}>Person</Label>
              <Input id={`person_name_${tradeId}`} name="person_name" placeholder="Shareholder name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`amount_usd_${tradeId}`}>Amount (USD)</Label>
              <Input id={`amount_usd_${tradeId}`} min="0.01" name="amount_usd" required step="0.01" type="number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`wire_date_${tradeId}`}>Wire Date</Label>
              <Input defaultValue={todayInputValue()} id={`wire_date_${tradeId}`} name="wire_date" required type="date" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor={`reference_${tradeId}`}>Reference</Label>
              <Input id={`reference_${tradeId}`} name="reference" placeholder="Wire reference number" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor={`notes_${tradeId}`}>Notes</Label>
              <Textarea id={`notes_${tradeId}`} name="notes" rows={2} />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePayoutButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteShareholderPayout(payoutId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Payout deleted");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="h-7 w-7 text-red-400 hover:text-red-600" size="icon" type="button" variant="ghost">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete payout</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete payout record?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the record from Rock Hill, but it does not reverse the actual wire transfer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CompanyFinancePage({
  activeTrades,
  canEdit = true,
  payoutInvoices,
  payouts,
  settledTrades,
}: {
  settledTrades: SettledTrade[];
  activeTrades: ActiveTrade[];
  payoutInvoices: PayoutInvoice[];
  payouts: ShareholderPayout[];
  canEdit?: boolean;
}) {
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set());
  const settled = settledTrades.map((trade) => ({
    ...trade,
    book: normalizeOne(trade.book) as Book,
    client: normalizeOne(trade.client),
  }));
  const active = activeTrades.map((trade) => ({
    ...trade,
    book: normalizeOne(trade.book),
    client: normalizeOne(trade.client),
    client_invoices: normalizeArray(trade.client_invoices),
    supplier_invoices_outgoing: normalizeArray(trade.supplier_invoices_outgoing),
    trade_expenses: normalizeArray(trade.trade_expenses),
  }));
  const totalNetProfit = settled.reduce(
    (sum, trade) => sum + (trade.book?.status === "confirmed" ? Number(trade.book.net_profit_usd ?? 0) : 0),
    0
  );
  const totalTax = settled.reduce(
    (sum, trade) => sum + (trade.book?.status === "confirmed" ? Number(trade.book.corporate_tax_usd ?? 0) : 0),
    0
  );
  const paidPayoutInvoices = payoutInvoices.filter((invoice) => invoice.status === "paid");
  const invoicePayoutTotal = paidPayoutInvoices.reduce((sum, invoice) => sum + Number(invoice.dividend_usd), 0);
  const manualPayoutTotal = payouts.reduce((sum, payout) => sum + Number(payout.amount_usd), 0);
  const totalPayouts = manualPayoutTotal + invoicePayoutTotal;
  const retained = totalNetProfit - totalPayouts - totalTax;
  const payableRows = Object.values(
    settled.reduce<
      Record<string, { name: string; totalShare: number; paid: number; payable: number }>
    >((acc, trade) => {
      if (trade.book?.status !== "confirmed") return acc;

      for (const line of trade.book.lines ?? []) {
        if (isTonyName(line.person_name)) continue;

        const key = line.person_name.trim().toLowerCase();
        const paidByInvoice = paidPayoutInvoices
          .filter(
            (invoice) =>
              invoice.trade_id === trade.id &&
              (invoice.trade_shareholder_id === line.trade_shareholder_id ||
                invoice.person_name.trim().toLowerCase() === key)
          )
          .reduce((sum, invoice) => sum + Number(invoice.dividend_usd), 0);
        const paidByManual = payouts
          .filter((payout) => payout.trade_id === trade.id && payout.person_name.trim().toLowerCase() === key)
          .reduce((sum, payout) => sum + Number(payout.amount_usd), 0);

        if (!acc[key]) {
          acc[key] = { name: line.person_name, paid: 0, payable: 0, totalShare: 0 };
        }

        acc[key].totalShare += Number(line.net_share_usd ?? 0);
        acc[key].paid += paidByInvoice + paidByManual;
        acc[key].payable = acc[key].totalShare - acc[key].paid;
      }

      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  function toggleExpand(id: string) {
    setExpandedTrades((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-[#0d1b34]">Company Finance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Aggregated profit and payout tracking across settled and active trades.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Net Profit"
          sub={`${settled.filter((trade) => trade.book?.status === "confirmed").length} settled trades`}
          value={usd(totalNetProfit)}
        />
        <StatCard label="Tax Obligation" sub="Corporate tax across settled trades" value={usd(totalTax)} />
        <StatCard label="Total Payouts" sub={`${payouts.length} recorded payments`} value={usd(totalPayouts)} />
        <StatCard highlight={retained >= 0} label="Company Retained" sub="Net profit minus payouts and tax" value={usd(retained)} />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Payable</CardTitle>
        </CardHeader>
        <CardContent>
          {payableRows.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {payableRows.map((row) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4" key={row.name}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0d1b34]">{row.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Paid: {usd(row.paid)} / Total: {usd(row.totalShare)}
                      </p>
                    </div>
                    <p className={`text-lg font-bold ${row.payable > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {usd(Math.max(row.payable, 0))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No partner payable amounts yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Settled Trades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {settled.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Trade</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Net Profit</TableHead>
                  <TableHead className="text-right">Payouts</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {settled.map((trade) => {
                  const book = trade.book;
                  const isExpanded = expandedTrades.has(trade.id);
                  const tradePayouts = payouts.filter((payout) => payout.trade_id === trade.id);
                  const payoutTotal = tradePayouts.reduce((sum, payout) => sum + Number(payout.amount_usd), 0);
                  const bookConfirmed = book?.status === "confirmed";

                  return (
                    <Fragment key={trade.id}>
                      <TableRow className="cursor-pointer hover:bg-slate-50" onClick={() => toggleExpand(trade.id)}>
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{trade.trade_id}</TableCell>
                        <TableCell>{trade.client?.code ?? "-"}</TableCell>
                        <TableCell>{formatDate(trade.trade_date)}</TableCell>
                        <TableCell className="text-right">
                          {bookConfirmed ? usd(Number(book?.gross_profit_usd ?? 0)) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {bookConfirmed ? usd(Number(book?.corporate_tax_usd ?? 0)) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {bookConfirmed ? (
                            usd(Number(book?.net_profit_usd ?? 0))
                          ) : (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-600" variant="outline">
                              Book not confirmed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{payoutTotal > 0 ? usd(payoutTotal) : "-"}</TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          {canEdit ? <AddPayoutDialog tradeCode={trade.trade_id} tradeId={trade.id} /> : null}
                        </TableCell>
                      </TableRow>

                      {isExpanded ? (
                        <TableRow>
                          <TableCell className="bg-slate-50 p-0" colSpan={9}>
                            <div className="space-y-4 p-4">
                              {bookConfirmed && book?.lines?.length ? (
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Profit Split
                                  </p>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-xs text-slate-500">
                                        <th className="pb-1 text-left font-medium">Person</th>
                                        <th className="pb-1 text-right font-medium">Split %</th>
                                        <th className="pb-1 text-right font-medium">Gross Share</th>
                                        <th className="pb-1 text-right font-medium">Tax Contribution</th>
                                        <th className="pb-1 text-right font-medium">Net Share</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {book.lines.map((line) => (
                                        <tr className="border-t border-slate-100" key={line.id}>
                                          <td className="py-1">{line.person_name}</td>
                                          <td className="py-1 text-right">{Number(line.split_pct).toFixed(1)}%</td>
                                          <td className="py-1 text-right">{usd(Number(line.gross_share_usd))}</td>
                                          <td className="py-1 text-right text-red-600">
                                            -{usd(Number(line.tax_contribution_usd))}
                                          </td>
                                          <td className="py-1 text-right font-semibold text-emerald-700">
                                            {usd(Number(line.net_share_usd))}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}

                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Payouts Recorded
                                </p>
                                {tradePayouts.length ? (
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-xs text-slate-500">
                                        <th className="pb-1 text-left font-medium">Person</th>
                                        <th className="pb-1 text-left font-medium">Date</th>
                                        <th className="pb-1 text-left font-medium">Reference</th>
                                        <th className="pb-1 text-right font-medium">Amount</th>
                                        <th />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tradePayouts.map((payout) => (
                                        <tr className="border-t border-slate-100" key={payout.id}>
                                          <td className="py-1">{payout.person_name}</td>
                                          <td className="py-1">{formatDate(payout.wire_date)}</td>
                                          <td className="py-1 text-slate-500">{payout.reference ?? "-"}</td>
                                          <td className="py-1 text-right font-medium">{usd(Number(payout.amount_usd))}</td>
                                          <td className="py-1 text-right">
                                            {canEdit ? <DeletePayoutButton payoutId={payout.id} /> : null}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="text-xs text-slate-400">No payouts recorded yet.</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 py-4 text-sm text-slate-500">No settled trades yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Active Trades - Projection</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {active.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Supplier Cost</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Est. Net Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((trade) => {
                  const revenue = trade.client_invoices.reduce((sum, invoice) => sum + Number(invoice.total_usd ?? 0), 0);
                  const supplierCost = trade.supplier_invoices_outgoing.reduce(
                    (sum, invoice) => sum + Number(invoice.total_usd ?? 0),
                    0
                  );
                  const expenses = trade.trade_expenses.reduce((sum, expense) => sum + Number(expense.amount_usd ?? 0), 0);
                  const estimatedProfit = revenue - supplierCost - expenses;
                  const bookProfit = trade.book?.net_profit_usd;

                  return (
                    <TableRow key={trade.id}>
                      <TableCell className="font-medium">
                        <Link className="text-[#0d1b34] hover:underline" href={`/trades/${trade.id}`}>
                          {trade.trade_id}
                        </Link>
                      </TableCell>
                      <TableCell>{trade.client?.code ?? "-"}</TableCell>
                      <TableCell>
                        <Badge className="capitalize" variant="outline">
                          {trade.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{usd(revenue)}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {supplierCost > 0 ? `-${usd(supplierCost)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right text-red-600">{expenses > 0 ? `-${usd(expenses)}` : "-"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {bookProfit != null ? (
                          <span className="text-xs text-slate-400">Book: {usd(Number(bookProfit))}</span>
                        ) : (
                          <span className={estimatedProfit >= 0 ? "text-emerald-700" : "text-red-600"}>
                            {usd(estimatedProfit)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 py-4 text-sm text-slate-500">No active trades.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
