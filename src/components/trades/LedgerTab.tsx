"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { addLedgerEntry, deleteLedgerEntry } from "@/app/actions/trade-ledger";
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
  client_payment_received: "Client Payment",
  expense_vendor_payment: "Vendor Payment",
  misc: "Miscellaneous",
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
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatUsd(value: number | null | undefined) {
  if (value == null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
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
    { color: "text-green-700", label: "Total Received", value: formatUsd(totalIn) },
    { color: "text-red-700", label: "Total Sent", value: formatUsd(totalOut) },
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

function AddLedgerEntryDialog({
  clientInvoices,
  exchangeRates,
  supplierInvoices,
  tradeId,
  vendorInvoices,
}: {
  tradeId: string;
  clientInvoices: ClientInvoice[];
  supplierInvoices: SupplierInvoiceOutgoing[];
  vendorInvoices: ExpenseVendorInvoice[];
  exchangeRates: ExchangeRate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<EntryType>("client_payment_received");

  const forcedDirection = FORCED_DIRECTION[entryType];
  const invoiceLink = LINKS_TO_INVOICE[entryType];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await addLedgerEntry(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Ledger entry added");
      setOpen(false);
      setEntryType("client_payment_received");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Ledger Entry</DialogTitle>
          <DialogDescription>Record a cash movement for this trade.</DialogDescription>
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
              <Select defaultValue="in" name="direction">
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
              <Label htmlFor="le_date">Entry Date</Label>
              <Input
                defaultValue={todayInputValue()}
                disabled={isPending}
                id="le_date"
                name="entry_date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="le_ref">Reference Number</Label>
              <Input disabled={isPending} id="le_ref" name="reference_number" placeholder="Wire / TT ref" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="le_usd">Amount (USD)</Label>
              <Input
                disabled={isPending}
                id="le_usd"
                min="0.01"
                name="amount_usd"
                placeholder="0.00"
                step="0.01"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="le_rmb">Amount (RMB)</Label>
              <Input
                disabled={isPending}
                id="le_rmb"
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
              <Label htmlFor="le_fee">Bank Fee (USD)</Label>
              <Input
                defaultValue="0"
                disabled={isPending}
                id="le_fee"
                min="0"
                name="bank_fee_usd"
                step="0.01"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label>Exchange Rate (optional)</Label>
              <Select name="exchange_rate_id">
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
          </div>

          {invoiceLink === "client" && clientInvoices.length ? (
            <div className="space-y-2">
              <Label>Link to Client Invoice (optional)</Label>
              <Select name="client_invoice_id">
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clientInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} - {formatUsd(invoice.total_usd)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {invoiceLink === "supplier" && supplierInvoices.length ? (
            <div className="space-y-2">
              <Label>Link to Supplier Invoice (optional)</Label>
              <Select name="supplier_invoice_id">
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {supplierInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} - {formatRmb(invoice.total_rmb)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {invoiceLink === "vendor" && vendorInvoices.length ? (
            <div className="space-y-2">
              <Label>Link to Vendor Invoice (optional)</Label>
              <Select name="expense_vendor_invoice_id">
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vendorInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number ?? invoice.id.slice(0, 8)} - {formatUsd(invoice.amount_usd)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="le_notes">Notes</Label>
            <Textarea disabled={isPending} id="le_notes" name="notes" rows={2} />
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
          <AlertDialogTitle>Delete ledger entry?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this ledger entry. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            disabled={isPending}
            onClick={handleDelete}
          >
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
          <CardTitle>Cash Movements</CardTitle>
          {canManage ? (
            <AddLedgerEntryDialog
              clientInvoices={clientInvoices}
              exchangeRates={exchangeRates}
              supplierInvoices={supplierInvoices}
              tradeId={tradeId}
              vendorInvoices={vendorInvoices}
            />
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
                  <TableHead>Amount USD</TableHead>
                  <TableHead>Amount RMB</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Ref #</TableHead>
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
                    <TableCell className="text-right tabular-nums">{formatUsd(entry.amount_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRmb(entry.amount_rmb)}</TableCell>
                    <TableCell className="text-right text-sm text-slate-500">
                      {Number(entry.bank_fee_usd) > 0 ? formatUsd(entry.bank_fee_usd) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.reference_number ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{linkedInvoiceLabel(entry) ?? "-"}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-sm text-slate-500">
                      {entry.notes ?? "-"}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <DeleteEntryButton entryId={entry.id} tradeId={tradeId} />
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
