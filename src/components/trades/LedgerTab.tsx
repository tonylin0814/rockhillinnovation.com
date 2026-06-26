"use client";

import { Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { addLedgerEntry, deleteLedgerEntry, updateLedgerEntry } from "@/app/actions/trade-ledger";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { buildDownloadUrl } from "@/lib/download";
import type {
  ClientInvoice,
  ExchangeRate,
  ExpenseVendorInvoice,
  SupplierInvoiceOutgoing,
  TradeLedgerEntry,
} from "@/types";

type EntryType = TradeLedgerEntry["entry_type"];

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  bank_fee: "Bank Fee",
  client_payment_received: "Client Receipt",
  expense_vendor_payment: "Vendor Expense",
  misc: "Other",
  reimbursement: "Reimbursement",
  supplier_payment_sent: "Supplier Payment",
};

const FORCED_DIRECTION: Partial<Record<EntryType, "in" | "out">> = {
  bank_fee: "out",
  client_payment_received: "in",
  expense_vendor_payment: "out",
  supplier_payment_sent: "out",
};

const LINKS_TO_INVOICE: Partial<Record<EntryType, "client" | "supplier" | "vendor">> = {
  client_payment_received: "client",
  expense_vendor_payment: "vendor",
  supplier_payment_sent: "supplier",
};

const DIRECTION_CLASSES = {
  in: "border-green-200 bg-green-50 text-green-700",
  out: "border-red-200 bg-red-50 text-red-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function formatUsd(value: number | null | undefined) {
  return value == null ? "-" : new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function formatRmb(value: number | null | undefined) {
  if (value == null) {
    return "-";
  }

  return `\u00A5${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function inputNumberValue(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function linkedInvoiceLabel(entry: TradeLedgerEntry): string | null {
  const clientInvoice = Array.isArray(entry.client_invoice) ? entry.client_invoice[0] : entry.client_invoice;
  const supplierInvoice = Array.isArray(entry.supplier_invoice) ? entry.supplier_invoice[0] : entry.supplier_invoice;
  const vendorInvoice = Array.isArray(entry.vendor_invoice) ? entry.vendor_invoice[0] : entry.vendor_invoice;

  return clientInvoice?.invoice_number ?? supplierInvoice?.invoice_number ?? vendorInvoice?.invoice_number ?? null;
}

function LedgerSummary({ entries }: { entries: TradeLedgerEntry[] }) {
  const totalIn = roundMoney(
    entries
      .filter((entry) => entry.direction === "in" && entry.amount_usd != null)
      .reduce((sum, entry) => sum + Number(entry.amount_usd), 0)
  );
  const totalOut = roundMoney(
    entries
      .filter((entry) => entry.direction === "out" && entry.amount_usd != null)
      .reduce((sum, entry) => sum + Number(entry.amount_usd), 0)
  );
  const totalFees = roundMoney(entries.reduce((sum, entry) => sum + Number(entry.bank_fee_usd ?? 0), 0));
  const net = roundMoney(totalIn - totalOut - totalFees);
  const stats = [
    { color: "text-green-700", label: "Income", value: formatUsd(totalIn) },
    { color: "text-red-700", label: "Expenses", value: formatUsd(totalOut) },
    { color: "text-slate-600", label: "Bank Fees", value: formatUsd(totalFees) },
    { color: net >= 0 ? "text-green-700" : "text-red-700", label: "Net (USD)", value: formatUsd(net) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card className="border-slate-200 shadow-sm" key={stat.label}>
          <CardContent className="pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className={`mt-1 text-xl font-semibold ${stat.color}`}>{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LedgerEntryDialog({
  children,
  clientInvoices,
  entry,
  exchangeRates,
  supplierInvoices,
  tradeId,
  vendorInvoices,
}: {
  children: ReactNode;
  tradeId: string;
  entry?: TradeLedgerEntry;
  clientInvoices: ClientInvoice[];
  supplierInvoices: SupplierInvoiceOutgoing[];
  vendorInvoices: ExpenseVendorInvoice[];
  exchangeRates: ExchangeRate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<EntryType>(entry?.entry_type ?? "client_payment_received");
  const [amountUsd, setAmountUsd] = useState(inputNumberValue(entry?.amount_usd));
  const [expectedUsd, setExpectedUsd] = useState(inputNumberValue(entry?.expected_amount_usd));
  const forcedDirection = FORCED_DIRECTION[entryType];
  const invoiceLink = LINKS_TO_INVOICE[entryType];
  const computedFee = useMemo(() => {
    const actual = Number(amountUsd);
    const expected = Number(expectedUsd);

    if (!amountUsd || !expectedUsd || !Number.isFinite(actual) || !Number.isFinite(expected)) {
      return null;
    }

    return roundMoney(Math.abs(expected - actual));
  }, [amountUsd, expectedUsd]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = entry
        ? await updateLedgerEntry(entry.id, tradeId, formData)
        : await addLedgerEntry(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(entry ? "Transaction updated" : "Transaction added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          <DialogDescription>Record an income or expense for this trade.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Entry Type</Label>
            <Select name="entry_type" onValueChange={(value) => setEntryType(value as EntryType)} value={entryType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ENTRY_TYPE_LABELS) as EntryType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {ENTRY_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {forcedDirection ? (
            <input name="direction" type="hidden" value={forcedDirection} />
          ) : (
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select defaultValue={entry?.direction ?? "in"} name="direction">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">In (received)</SelectItem>
                  <SelectItem value="out">Out (sent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`le_date_${entry?.id ?? "new"}`}>Entry Date</Label>
              <Input
                defaultValue={entry?.entry_date ?? todayInputValue()}
                disabled={isPending}
                id={`le_date_${entry?.id ?? "new"}`}
                name="entry_date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`le_ref_${entry?.id ?? "new"}`}>Reference Number</Label>
              <Input
                defaultValue={entry?.reference_number ?? ""}
                disabled={isPending}
                id={`le_ref_${entry?.id ?? "new"}`}
                name="reference_number"
                placeholder="Wire / TT ref"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`le_usd_${entry?.id ?? "new"}`}>Amount (USD)</Label>
              <Input
                disabled={isPending}
                id={`le_usd_${entry?.id ?? "new"}`}
                min="0.01"
                name="amount_usd"
                onChange={(event) => setAmountUsd(event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={amountUsd}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`le_rmb_${entry?.id ?? "new"}`}>Amount (RMB)</Label>
              <Input
                defaultValue={inputNumberValue(entry?.amount_rmb)}
                disabled={isPending}
                id={`le_rmb_${entry?.id ?? "new"}`}
                min="0.01"
                name="amount_rmb"
                placeholder="0.00"
                step="0.01"
                type="number"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`le_expected_${entry?.id ?? "new"}`}>Expected Amount (USD)</Label>
              <Input
                disabled={isPending}
                id={`le_expected_${entry?.id ?? "new"}`}
                min="0.01"
                name="expected_amount_usd"
                onChange={(event) => setExpectedUsd(event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={expectedUsd}
              />
              {computedFee != null ? (
                <p className="text-xs text-slate-500">Bank fee = |expected - actual| = {formatUsd(computedFee)}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`le_fee_${entry?.id ?? "new"}`}>Bank Fee (USD)</Label>
              <Input
                defaultValue={inputNumberValue(entry?.bank_fee_usd ?? 0)}
                disabled={isPending}
                id={`le_fee_${entry?.id ?? "new"}`}
                min="0"
                name="bank_fee_usd"
                step="0.01"
                type="number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Exchange Rate (optional)</Label>
            <Select defaultValue={entry?.exchange_rate_id ?? "none"} name="exchange_rate_id">
              <SelectTrigger>
                <SelectValue placeholder="Select locked rate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {exchangeRates.map((rate) => (
                  <SelectItem key={rate.id} value={rate.id}>
                    {rate.payment_type === "deposit" ? "Deposit" : "Final"} -{" "}
                    {`\u00A5${Number(rate.rate_rmb_per_usd).toFixed(4)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {invoiceLink === "client" && clientInvoices.length ? (
            <InvoiceSelect
              defaultValue={entry?.client_invoice_id ?? "none"}
              invoices={clientInvoices.map((invoice) => ({
                id: invoice.id,
                label: `${invoice.invoice_number} - ${formatUsd(invoice.total_usd)}`,
              }))}
              label="Link to Client Invoice"
              name="client_invoice_id"
            />
          ) : null}

          {invoiceLink === "supplier" && supplierInvoices.length ? (
            <InvoiceSelect
              defaultValue={entry?.supplier_invoice_id ?? "none"}
              invoices={supplierInvoices.map((invoice) => ({
                id: invoice.id,
                label: `${invoice.invoice_number} - ${formatRmb(invoice.total_rmb)}`,
              }))}
              label="Link to Supplier Invoice"
              name="supplier_invoice_id"
            />
          ) : null}

          {invoiceLink === "vendor" && vendorInvoices.length ? (
            <InvoiceSelect
              defaultValue={entry?.expense_vendor_invoice_id ?? "none"}
              invoices={vendorInvoices.map((invoice) => ({
                id: invoice.id,
                label: `${invoice.invoice_number ?? invoice.id.slice(0, 8)} - ${formatUsd(invoice.amount_usd)}`,
              }))}
              label="Link to Vendor Invoice"
              name="expense_vendor_invoice_id"
            />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`le_proof_${entry?.id ?? "new"}`}>Proof of Payment</Label>
            <Input
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={isPending}
              id={`le_proof_${entry?.id ?? "new"}`}
              name="proof_file"
              type="file"
            />
            {entry?.proof_onedrive_url ? (
              <p className="text-xs text-slate-500">Current proof: {entry.proof_file_name ?? "proof"}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`le_notes_${entry?.id ?? "new"}`}>Notes</Label>
            <Textarea
              defaultValue={entry?.notes ?? ""}
              disabled={isPending}
              id={`le_notes_${entry?.id ?? "new"}`}
              name="notes"
              rows={2}
            />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? "Saving..." : "Save Entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceSelect({
  defaultValue,
  invoices,
  label,
  name,
}: {
  name: string;
  label: string;
  defaultValue: string;
  invoices: { id: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label} (optional)</Label>
      <Select defaultValue={defaultValue} name={name}>
        <SelectTrigger>
          <SelectValue placeholder="Select invoice" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {invoices.map((invoice) => (
            <SelectItem key={invoice.id} value={invoice.id}>
              {invoice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DeleteEntryButton({ entryId, tradeId }: { entryId: string; tradeId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteLedgerEntry(entryId, tradeId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Entry deleted");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} size="icon" type="button" variant="ghost">
          <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" />
          <span className="sr-only">Delete entry</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this transaction. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleDelete}>
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LedgerTab({
  canManage,
  clientInvoices,
  exchangeRates,
  initialEntries,
  supplierInvoices,
  tradeId,
  vendorInvoices,
}: {
  tradeId: string;
  canManage: boolean;
  initialEntries: TradeLedgerEntry[];
  clientInvoices: ClientInvoice[];
  supplierInvoices: SupplierInvoiceOutgoing[];
  vendorInvoices: ExpenseVendorInvoice[];
  exchangeRates: ExchangeRate[];
}) {
  return (
    <div className="space-y-6">
      <LedgerSummary entries={initialEntries} />

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Transactions</CardTitle>
          {canManage ? (
            <LedgerEntryDialog
              clientInvoices={clientInvoices}
              exchangeRates={exchangeRates}
              supplierInvoices={supplierInvoices}
              tradeId={tradeId}
              vendorInvoices={vendorInvoices}
            >
              <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </LedgerEntryDialog>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {initialEntries.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dir</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Amount USD</TableHead>
                  <TableHead className="text-right">Amount RMB</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Ref #</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Notes</TableHead>
                  {canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(entry.entry_date)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{ENTRY_TYPE_LABELS[entry.entry_type]}</TableCell>
                    <TableCell>
                      <Badge className={DIRECTION_CLASSES[entry.direction]} variant="outline">
                        {entry.direction === "in" ? "In" : "Out"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(entry.expected_amount_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(entry.amount_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRmb(entry.amount_rmb)}</TableCell>
                    <TableCell className="text-right text-sm text-slate-500">
                      {Number(entry.bank_fee_usd) > 0 ? formatUsd(entry.bank_fee_usd) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.reference_number ?? "-"}</TableCell>
                    <TableCell>
                      {entry.proof_onedrive_url ? (
                        <a
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
                          download
                          href={buildDownloadUrl(entry.proof_onedrive_url, entry.proof_file_name ?? "proof")}
                        >
                          <Paperclip className="h-4 w-4 text-[#0d1b34]" />
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{linkedInvoiceLabel(entry) ?? "-"}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-sm text-slate-500">{entry.notes ?? "-"}</TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <LedgerEntryDialog
                            clientInvoices={clientInvoices}
                            entry={entry}
                            exchangeRates={exchangeRates}
                            supplierInvoices={supplierInvoices}
                            tradeId={tradeId}
                            vendorInvoices={vendorInvoices}
                          >
                            <Button size="icon" type="button" variant="ghost">
                              <Pencil className="h-4 w-4 text-slate-400 hover:text-[#0d1b34]" />
                              <span className="sr-only">Edit entry</span>
                            </Button>
                          </LedgerEntryDialog>
                          <DeleteEntryButton entryId={entry.id} tradeId={tradeId} />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 py-10 text-sm text-slate-500">No entries yet. Add the first cash movement.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
