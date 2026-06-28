"use client";

import { Download, FileText, Loader2, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { deletePayoutInvoiceDownload, generatePayoutInvoice, updatePayoutStatus } from "@/app/actions/payout-invoices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/context/LanguageContext";
import type { PayoutInvoice } from "@/types";

export type PayoutShareholder = {
  id: string;
  expense_vendor_id: string | null;
  expense_vendor?: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;
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

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function invoiceDateInputValue(value: string | null | undefined) {
  if (!value) return todayInputValue();
  return value.slice(0, 10);
}

function vendorForShareholder(shareholder: PayoutShareholder) {
  return normalizeOne(shareholder.expense_vendor);
}

function defaultInvoiceNumber(trade: PayoutTrade, shareholder: PayoutShareholder, invoice: PayoutInvoice | null) {
  if (invoice?.invoice_number) return invoice.invoice_number;
  const vendor = vendorForShareholder(shareholder);
  const tradeNumber = trade.trade_id.replace(/^MLP-?/i, "");
  const namePart = shareholder.person_name.replace(/[^a-z0-9]+/gi, "").slice(0, 10).toUpperCase();
  return `${vendor?.code ?? "PAYOUT"}-${tradeNumber}-${namePart || "SHARE"}`;
}

type EditableLine = {
  id: string;
  description: string;
  amount_usd: string;
};

function defaultLines(invoice: PayoutInvoice | null, shareholder: PayoutShareholder, dividend: number | null) {
  const existingLines = invoice?.lines?.length ? invoice.lines : null;

  if (existingLines) {
    return existingLines.map((line, index) => ({
      amount_usd: String(line.amount_usd ?? 0),
      description: line.description,
      id: `${index}-${line.description}`,
    }));
  }

  return [
    {
      amount_usd: String(dividend ?? 0),
      description: `Profit distribution - ${shareholder.person_name}`,
      id: "default-profit-distribution",
    },
  ];
}

function GeneratePayoutInvoiceDialog({
  children,
  dividend,
  invoice,
  shareholder,
  trade,
}: {
  children: ReactNode;
  dividend: number | null;
  invoice: PayoutInvoice | null;
  shareholder: PayoutShareholder;
  trade: PayoutTrade;
}) {
  const router = useRouter();
  const vendor = vendorForShareholder(shareholder);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<EditableLine[]>(() => defaultLines(invoice, shareholder, dividend));
  const lineTotal = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount_usd) || 0), 0),
    [lines]
  );

  function resetLines() {
    setLines(defaultLines(invoice, shareholder, dividend));
  }

  function updateLine(id: string, patch: Partial<EditableLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        amount_usd: "0",
        description: "",
        id: crypto.randomUUID(),
      },
    ]);
  }

  function removeLine(id: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : current));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!vendor) {
      setError("Select an invoice vendor on the trade shareholder first.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set(
      "lines",
      JSON.stringify(
        lines.map((line) => ({
          amount_usd: Number(line.amount_usd) || 0,
          description: line.description,
        }))
      )
    );

    startTransition(async () => {
      const result = await generatePayoutInvoice(trade.id, shareholder.id, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Payout invoice generated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setError(null);
        if (nextOpen) resetLines();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{invoice?.invoice_url ? "Regenerate Payout Invoice" : "Generate Payout Invoice"}</DialogTitle>
          <DialogDescription>
            Uses the {vendor?.code ?? "selected vendor"} template and uploads the PDF to OneDrive.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`payout_invoice_number_${shareholder.id}`}>Invoice Number</Label>
              <Input
                defaultValue={defaultInvoiceNumber(trade, shareholder, invoice)}
                disabled={isPending}
                id={`payout_invoice_number_${shareholder.id}`}
                name="invoice_number"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`payout_invoice_date_${shareholder.id}`}>Invoice Date</Label>
              <Input
                defaultValue={invoiceDateInputValue(invoice?.invoice_date)}
                disabled={isPending}
                id={`payout_invoice_date_${shareholder.id}`}
                name="invoice_date"
                required
                type="date"
              />
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#0d1b34]">Invoice Lines</p>
                <p className="text-xs text-slate-500">Add or adjust the payout invoice detail lines.</p>
              </div>
              <Button disabled={isPending} onClick={addLine} type="button" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line) => (
                <div className="grid gap-2 md:grid-cols-[1fr_160px_36px]" key={line.id}>
                  <Input
                    disabled={isPending}
                    onChange={(event) => updateLine(line.id, { description: event.target.value })}
                    placeholder="Description"
                    required
                    value={line.description}
                  />
                  <Input
                    disabled={isPending}
                    onChange={(event) => updateLine(line.id, { amount_usd: event.target.value })}
                    placeholder="Amount (USD)"
                    required
                    step="0.01"
                    type="number"
                    value={line.amount_usd}
                  />
                  <Button
                    disabled={isPending || lines.length === 1}
                    onClick={() => removeLine(line.id)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right text-sm font-semibold text-[#0d1b34]">Total: {usd(lineTotal)}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`payout_notes_${shareholder.id}`}>Notes</Label>
            <Textarea
              defaultValue={invoice?.notes ?? ""}
              disabled={isPending}
              id={`payout_notes_${shareholder.id}`}
              name="notes"
            />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              {isPending ? "Generating..." : "Generate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
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
  dividend,
  invoice,
  shareholder,
  trade,
}: {
  canEdit: boolean;
  dividend: number | null;
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

  function deleteDownload() {
    if (!invoice) return;
    setPendingKey(`${invoice.id}-delete`);
    startTransition(async () => {
      const result = await deletePayoutInvoiceDownload(invoice.id);
      setPendingKey(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Payout invoice download deleted");
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <GeneratePayoutInvoiceDialog dividend={dividend} invoice={invoice} shareholder={shareholder} trade={trade}>
        <Button disabled={isPending} size="sm" type="button">
          <FileText className="mr-2 h-4 w-4" />
          {invoice?.invoice_url ? "Regenerate" : t.payout.generateInvoice}
        </Button>
      </GeneratePayoutInvoiceDialog>
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
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              disabled={!invoice.invoice_url || pendingKey === `${invoice.id}-delete`}
              onClick={deleteDownload}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Download
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
                            <PayoutActions
                              canEdit={canEdit}
                              dividend={dividend}
                              invoice={invoice}
                              shareholder={shareholder}
                              trade={trade}
                            />
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
