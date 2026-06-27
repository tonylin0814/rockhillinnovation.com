"use client";

import { ChevronDown, FileText, Loader2, Mail, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, Fragment, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteClientInvoice, updateClientInvoice, updateInvoiceStatus } from "@/app/actions/invoices";
import { draftClientInvoiceEmail } from "@/app/actions/send-invoice";
import {
  deleteSupplierInvoice,
  updateSupplierInvoice,
  updateSupplierInvoiceStatus,
} from "@/app/actions/supplier-invoices-outgoing";
import { deleteVendorOutgoingInvoice } from "@/app/actions/vendor-invoices";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { buildDownloadUrl } from "@/lib/download";
import type { ClientInvoice, ExpenseVendorInvoice, SupplierInvoiceOutgoing } from "@/types";
import { EditVendorOutgoingInvoiceDialog } from "./EditVendorOutgoingInvoiceDialog";
import { GenerateAdditionalInvoiceDialog } from "./GenerateAdditionalInvoiceDialog";
import { GenerateDepositInvoiceDialog } from "./GenerateDepositInvoiceDialog";
import { GenerateInvoiceDialog } from "./GenerateProFormaDialog";
import { GenerateSupplierCommercialInvoiceDialog } from "./GenerateSupplierCommercialInvoiceDialog";
import { GenerateSupplierInvoiceDialog } from "./GenerateSupplierInvoiceDialog";
import { GenerateVendorOutgoingInvoiceDialog } from "./GenerateVendorOutgoingInvoiceDialog";
import { SupplierInvoiceMatchDialog } from "./SupplierInvoiceMatchDialog";

const statusLabels = { draft: "Draft", paid: "Paid", sent: "Sent" } as const;
type SupplierOption = { code: string; id: string; name: string };
type VendorOption = { code: string; id: string; name: string };
const statusClasses: Record<string, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusClasses[status] ?? statusClasses.draft} variant="outline">
      {statusLabels[status as keyof typeof statusLabels] ?? status}
    </Badge>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatRmb(value: number) {
  return `\u00A5${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

function formatQuantityInput(value: string) {
  if (!value.trim()) {
    return "";
  }

  const numericValue = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(numericValue);
}

function parseFormattedNumber(value: string) {
  return value.replace(/,/g, "");
}

const clientTypeLabels: Record<ClientInvoice["invoice_type"], string> = {
  commercial: "Commercial Invoice",
  deposit: "Deposit Invoice",
  final: "Final Invoice",
  pro_forma: "Pro-Forma Invoice",
};

const clientTypeClasses: Record<ClientInvoice["invoice_type"], string> = {
  commercial: "border-[#0d1b34] bg-[#0d1b34]/10 text-[#0d1b34]",
  deposit: "border-blue-200 bg-blue-50 text-blue-700",
  final: "border-green-200 bg-green-50 text-green-700",
  pro_forma: "border-slate-200 bg-slate-100 text-slate-700",
};

function ClientTypeBadge({ type }: { type: ClientInvoice["invoice_type"] }) {
  return (
    <Badge className={clientTypeClasses[type]} variant="outline">
      {clientTypeLabels[type]}
    </Badge>
  );
}

function ClientInvoiceTypeDisplay({ invoice }: { invoice: ClientInvoice }) {
  if (invoice.display_label) {
    return (
      <Badge className="border-green-200 bg-green-50 text-green-700" variant="outline">
        {invoice.display_label}
      </Badge>
    );
  }

  return <ClientTypeBadge type={invoice.invoice_type} />;
}

function ClientInvoiceStatusDropdown({ invoice }: { invoice: ClientInvoice }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: ClientInvoice["status"]) {
    startTransition(async () => {
      const result = await updateInvoiceStatus(invoice.id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Status updated");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={isPending} size="icon" type="button" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Update status</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(["draft", "sent", "paid"] as ClientInvoice["status"][]).map((status) => (
          <DropdownMenuItem disabled={status === invoice.status} key={status} onClick={() => setStatus(status)}>
            {statusLabels[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function EditClientInvoiceDialog({ invoice }: { invoice: ClientInvoice }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState(() =>
    (invoice.lines ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((line, index) => ({
        _key: line.id ?? `${invoice.id}-${index}`,
        description: line.description ?? "",
        quantity: String(line.quantity ?? 0),
        sort_order: index,
        unit_price_usd: String(line.unit_price_usd ?? 0),
      }))
  );

  function handleOpenChange(value: boolean) {
    setOpen(value);

    if (value) {
      setLines(
        (invoice.lines ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((line, index) => ({
            _key: line.id ?? `${invoice.id}-${index}`,
            description: line.description ?? "",
            quantity: String(line.quantity ?? 0),
            sort_order: index,
            unit_price_usd: String(line.unit_price_usd ?? 0),
          }))
      );
    }
  }

  function updateLine(index: number, field: "description" | "quantity" | "unit_price_usd", value: string) {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line))
    );
  }

  function addLine() {
    setLines((currentLines) => [
      ...currentLines,
      {
        _key: crypto.randomUUID(),
        description: "",
        quantity: "1",
        sort_order: currentLines.length,
        unit_price_usd: "0",
      },
    ]);
  }

  function removeLine(index: number) {
    setLines((currentLines) =>
      currentLines
        .filter((_, lineIndex) => lineIndex !== index)
        .map((line, lineIndex) => ({ ...line, sort_order: lineIndex }))
    );
  }

  const lineSubtotal = lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price_usd) || 0),
    0
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set(
      "invoice_lines_json",
      JSON.stringify(
        lines.map((line, index) => ({
          description: line.description,
          quantity: Number(line.quantity) || 0,
          sort_order: index,
          unit_price_usd: Number(line.unit_price_usd) || 0,
        }))
      )
    );

    startTransition(async () => {
      const result = await updateClientInvoice(invoice.id, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Client invoice updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" title="Edit invoice" type="button" variant="ghost">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit invoice</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Client Invoice</DialogTitle>
          <DialogDescription>Update invoice details. This does not regenerate the PDF file.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`client_invoice_number_${invoice.id}`}>Invoice Number</Label>
              <Input
                defaultValue={invoice.invoice_number}
                disabled={isPending}
                id={`client_invoice_number_${invoice.id}`}
                name="invoice_number"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`client_status_${invoice.id}`}>Status</Label>
              <Select defaultValue={invoice.status} disabled={isPending} name="status">
                <SelectTrigger id={`client_status_${invoice.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`client_invoice_date_${invoice.id}`}>Invoice Date</Label>
              <Input
                defaultValue={dateInputValue(invoice.invoice_date)}
                disabled={isPending}
                id={`client_invoice_date_${invoice.id}`}
                name="invoice_date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`client_due_date_${invoice.id}`}>Deposit Due Date</Label>
              <Input
                defaultValue={dateInputValue(invoice.due_date)}
                disabled={isPending}
                id={`client_due_date_${invoice.id}`}
                name="due_date"
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`client_deposit_pct_${invoice.id}`}>Deposit %</Label>
              <Input
                defaultValue={invoice.deposit_pct}
                disabled={isPending}
                id={`client_deposit_pct_${invoice.id}`}
                max="100"
                min="0"
                name="deposit_pct"
                step="0.01"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`client_payment_terms_${invoice.id}`}>Balance Due</Label>
              <Input
                defaultValue={invoice.payment_terms ?? ""}
                disabled={isPending}
                id={`client_payment_terms_${invoice.id}`}
                name="payment_terms"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`client_notes_${invoice.id}`}>Notes</Label>
            <Textarea
              defaultValue={invoice.notes ?? ""}
              disabled={isPending}
              id={`client_notes_${invoice.id}`}
              name="notes"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0d1b34]">Invoice Detail Lines</p>
                <p className="text-xs text-slate-500">These line edits update the invoice totals, but do not regenerate the PDF.</p>
              </div>
              <Button disabled={isPending} onClick={addLine} size="sm" type="button" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Description</TableHead>
                    <TableHead className="w-28">Qty</TableHead>
                    <TableHead className="w-36">Unit Price</TableHead>
                    <TableHead className="w-36 text-right">Total</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => {
                    const total = (Number(line.quantity) || 0) * (Number(line.unit_price_usd) || 0);

                    return (
                      <TableRow key={line._key}>
                        <TableCell>
                          <Input
                            disabled={isPending}
                            onChange={(event) => updateLine(index, "description", event.currentTarget.value)}
                            value={line.description}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isPending}
                            inputMode="decimal"
                            min="0"
                            onChange={(event) =>
                              updateLine(index, "quantity", parseFormattedNumber(event.currentTarget.value))
                            }
                            step="0.001"
                            type="text"
                            value={formatQuantityInput(line.quantity)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isPending}
                            min="0"
                            onChange={(event) => updateLine(index, "unit_price_usd", event.currentTarget.value)}
                            step="0.01"
                            type="number"
                            value={line.unit_price_usd}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatUsd(total)}</TableCell>
                        <TableCell>
                          <Button
                            disabled={isPending || lines.length === 1}
                            onClick={() => removeLine(index)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell className="font-semibold" colSpan={3}>
                      Subtotal
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatUsd(lineSubtotal)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SendInvoiceButton({ invoice }: { invoice: ClientInvoice }) {
  const [isPending, startTransition] = useTransition();

  if (!invoice.pdf_onedrive_url) {
    return null;
  }

  function handleDraft() {
    startTransition(async () => {
      let result;

      try {
        result = await draftClientInvoiceEmail(invoice.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create Outlook draft");
        return;
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.draftUrl) {
        window.open(result.draftUrl, "_blank", "noopener,noreferrer");
      }

      toast.success("Email draft opened in Outlook");
    });
  }

  return (
    <Button
      disabled={isPending}
      onClick={handleDraft}
      size="icon"
      title="Draft email in Outlook"
      type="button"
      variant="ghost"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
      <span className="sr-only">Draft email in Outlook</span>
    </Button>
  );
}

function DeleteClientInvoiceButton({ invoice }: { invoice: ClientInvoice }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClientInvoice(invoice.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Invoice deleted");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} size="icon" title="Delete invoice" type="button" variant="ghost">
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="sr-only">Delete invoice</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete invoice {invoice.invoice_number}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the invoice record and its PDF file from OneDrive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleDelete}>
            Delete Invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function GenerateClientInvoiceMenu({ orderNumber, tradeId }: { orderNumber?: string | null; tradeId: string }) {
  return (
    <div className="flex justify-end">
      <GenerateInvoiceDialog orderNumber={orderNumber} tradeId={tradeId}>
        <Button className="rounded-r-none bg-[#0d1b34] hover:bg-[#13294d]">
          <FileText className="mr-2 h-4 w-4" />
          Generate Commercial Invoice
        </Button>
      </GenerateInvoiceDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Choose client invoice type"
            className="rounded-l-none border-l border-white/20 bg-[#0d1b34] px-3 hover:bg-[#13294d]"
            type="button"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <GenerateInvoiceDialog orderNumber={orderNumber} tradeId={tradeId}>
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Commercial Invoice</DropdownMenuItem>
          </GenerateInvoiceDialog>
          <GenerateDepositInvoiceDialog orderNumber={orderNumber} tradeId={tradeId}>
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Deposit Invoice</DropdownMenuItem>
          </GenerateDepositInvoiceDialog>
          <GenerateAdditionalInvoiceDialog orderNumber={orderNumber} tradeId={tradeId}>
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Final / Additional Invoice</DropdownMenuItem>
          </GenerateAdditionalInvoiceDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const supplierTypeClasses: Record<SupplierInvoiceOutgoing["invoice_type"], string> = {
  commercial: "border-[#0d1b34] bg-[#0d1b34]/10 text-[#0d1b34]",
  deposit: "border-blue-200 bg-blue-50 text-blue-700",
  final: "border-green-200 bg-green-50 text-green-700",
};

function SupplierTypeBadge({ type }: { type: SupplierInvoiceOutgoing["invoice_type"] }) {
  const label = { commercial: "Commercial", deposit: "Deposit", final: "Final" }[type];

  return (
    <Badge className={supplierTypeClasses[type]} variant="outline">
      {label}
    </Badge>
  );
}

function SupplierInvoiceStatusDropdown({ invoice }: { invoice: SupplierInvoiceOutgoing }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: SupplierInvoiceOutgoing["status"]) {
    startTransition(async () => {
      const result = await updateSupplierInvoiceStatus(invoice.id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Status updated");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={isPending} size="icon" type="button" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Update status</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(["draft", "sent", "paid"] as SupplierInvoiceOutgoing["status"][]).map((status) => (
          <DropdownMenuItem disabled={status === invoice.status} key={status} onClick={() => setStatus(status)}>
            {statusLabels[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditSupplierInvoiceDialog({ invoice }: { invoice: SupplierInvoiceOutgoing }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState(() =>
    (invoice.lines ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((line, index) => ({
        _key: line.id ?? `${invoice.id}-${index}`,
        description_chinese: line.description_chinese ?? "",
        description_english: line.description_english ?? "",
        payment_category: line.payment_category ?? "produced",
        product_id: line.product_id,
        quantity: String(line.quantity ?? 0),
        sort_order: index,
        source_quote_line_id: line.source_quote_line_id,
        unit_price_rmb: String(line.unit_price_rmb ?? 0),
      }))
  );

  function handleOpenChange(value: boolean) {
    setOpen(value);

    if (value) {
      setLines(
        (invoice.lines ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((line, index) => ({
            _key: line.id ?? `${invoice.id}-${index}`,
            description_chinese: line.description_chinese ?? "",
            description_english: line.description_english ?? "",
            payment_category: line.payment_category ?? "produced",
            product_id: line.product_id,
            quantity: String(line.quantity ?? 0),
            sort_order: index,
            source_quote_line_id: line.source_quote_line_id,
            unit_price_rmb: String(line.unit_price_rmb ?? 0),
          }))
      );
    }
  }

  function updateLine(
    index: number,
    field: "description_chinese" | "description_english" | "quantity" | "unit_price_rmb",
    value: string
  ) {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line))
    );
  }

  function addLine() {
    setLines((currentLines) => [
      ...currentLines,
      {
        _key: crypto.randomUUID(),
        description_chinese: "",
        description_english: "",
        payment_category: "produced" as const,
        product_id: null,
        quantity: "1",
        sort_order: currentLines.length,
        source_quote_line_id: null,
        unit_price_rmb: "0",
      },
    ]);
  }

  function removeLine(index: number) {
    setLines((currentLines) =>
      currentLines
        .filter((_, lineIndex) => lineIndex !== index)
        .map((line, lineIndex) => ({ ...line, sort_order: lineIndex }))
    );
  }

  const lineSubtotal = lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price_rmb) || 0),
    0
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set(
      "supplier_invoice_lines_json",
      JSON.stringify(
        lines.map((line, index) => ({
          description_chinese: line.description_chinese,
          description_english: line.description_english,
          payment_category: line.payment_category,
          product_id: line.product_id,
          quantity: Number(line.quantity) || 0,
          sort_order: index,
          source_quote_line_id: line.source_quote_line_id,
          unit_price_rmb: Number(line.unit_price_rmb) || 0,
        }))
      )
    );

    startTransition(async () => {
      const result = await updateSupplierInvoice(invoice.id, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Supplier invoice updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" title="Edit supplier invoice" type="button" variant="ghost">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit supplier invoice</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Supplier Invoice</DialogTitle>
          <DialogDescription>Update supplier invoice details. This does not regenerate the PDF file.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`supplier_invoice_number_${invoice.id}`}>Invoice Number</Label>
              <Input
                defaultValue={invoice.invoice_number}
                disabled={isPending}
                id={`supplier_invoice_number_${invoice.id}`}
                name="invoice_number"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`supplier_status_${invoice.id}`}>Status</Label>
              <Select defaultValue={invoice.status} disabled={isPending} name="status">
                <SelectTrigger id={`supplier_status_${invoice.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`supplier_invoice_date_${invoice.id}`}>Invoice Date</Label>
              <Input
                defaultValue={dateInputValue(invoice.invoice_date)}
                disabled={isPending}
                id={`supplier_invoice_date_${invoice.id}`}
                name="invoice_date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`supplier_ref_${invoice.id}`}>Supplier Ref</Label>
              <Input
                defaultValue={invoice.supplier_invoice_ref ?? ""}
                disabled={isPending}
                id={`supplier_ref_${invoice.id}`}
                name="supplier_invoice_ref"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`supplier_amount_${invoice.id}`}>Supplier Stated Amount (RMB)</Label>
              <Input
                defaultValue={invoice.supplier_stated_amount_rmb ?? ""}
                disabled={isPending}
                id={`supplier_amount_${invoice.id}`}
                min="0"
                name="supplier_stated_amount_rmb"
                step="0.01"
                type="number"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`supplier_notes_${invoice.id}`}>Notes</Label>
            <Textarea
              defaultValue={invoice.notes ?? ""}
              disabled={isPending}
              id={`supplier_notes_${invoice.id}`}
              name="notes"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0d1b34]">Supplier Invoice Detail Lines</p>
                <p className="text-xs text-slate-500">These line edits update the invoice totals, but do not regenerate the PDF.</p>
              </div>
              <Button disabled={isPending} onClick={addLine} size="sm" type="button" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">Description</TableHead>
                    <TableHead className="w-28">Qty</TableHead>
                    <TableHead className="w-36">Unit (RMB)</TableHead>
                    <TableHead className="w-36 text-right">Total</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => {
                    const total = (Number(line.quantity) || 0) * (Number(line.unit_price_rmb) || 0);

                    return (
                      <TableRow key={line._key}>
                        <TableCell>
                          {(() => {
                            const usesChinese = !line.description_english && !!line.description_chinese;
                            const field = usesChinese ? "description_chinese" : "description_english";
                            const displayValue = usesChinese ? line.description_chinese : line.description_english;

                            return (
                              <Input
                                disabled={isPending}
                                lang={usesChinese ? "zh" : undefined}
                                onChange={(event) => updateLine(index, field, event.currentTarget.value)}
                                style={
                                  usesChinese
                                    ? { fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" }
                                    : undefined
                                }
                                value={displayValue}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isPending}
                            inputMode="decimal"
                            min="0"
                            onChange={(event) =>
                              updateLine(index, "quantity", parseFormattedNumber(event.currentTarget.value))
                            }
                            step="0.001"
                            type="text"
                            value={formatQuantityInput(line.quantity)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={isPending}
                            onChange={(event) => updateLine(index, "unit_price_rmb", event.currentTarget.value)}
                            step="any"
                            type="number"
                            value={line.unit_price_rmb}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatRmb(total)}</TableCell>
                        <TableCell>
                          <Button
                            disabled={isPending || lines.length === 1}
                            onClick={() => removeLine(index)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell className="font-semibold" colSpan={3}>
                      Subtotal
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatRmb(lineSubtotal)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSupplierInvoiceButton({ invoice }: { invoice: SupplierInvoiceOutgoing }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSupplierInvoice(invoice.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Supplier invoice deleted");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} size="icon" title="Delete supplier invoice" type="button" variant="ghost">
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="sr-only">Delete supplier invoice</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete supplier invoice {invoice.invoice_number}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the supplier invoice record and its PDF file from OneDrive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleDelete}>
            Delete Invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function GenerateSupplierInvoiceMenu({
  orderNumber,
  suppliers,
  tradeId,
  workingExchangeRate,
}: {
  orderNumber?: string | null;
  suppliers: SupplierOption[];
  tradeId: string;
  workingExchangeRate?: number | null;
}) {
  return (
    <div className="flex justify-end">
      <GenerateSupplierCommercialInvoiceDialog orderNumber={orderNumber} suppliers={suppliers} tradeId={tradeId}>
        <Button className="rounded-r-none bg-[#0d1b34] hover:bg-[#13294d]">
          <FileText className="mr-2 h-4 w-4" />
          Generate Supplier Invoice
        </Button>
      </GenerateSupplierCommercialInvoiceDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Choose supplier invoice type"
            className="rounded-l-none border-l border-white/20 bg-[#0d1b34] px-3 hover:bg-[#13294d]"
            type="button"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <GenerateSupplierCommercialInvoiceDialog orderNumber={orderNumber} suppliers={suppliers} tradeId={tradeId}>
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Commercial Invoice</DropdownMenuItem>
          </GenerateSupplierCommercialInvoiceDialog>
          <GenerateSupplierInvoiceDialog
            orderNumber={orderNumber}
            suppliers={suppliers}
            tradeId={tradeId}
            type="deposit"
            workingExchangeRate={workingExchangeRate}
          >
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Deposit Invoice</DropdownMenuItem>
          </GenerateSupplierInvoiceDialog>
          <GenerateSupplierInvoiceDialog
            orderNumber={orderNumber}
            suppliers={suppliers}
            tradeId={tradeId}
            type="final"
            workingExchangeRate={workingExchangeRate}
          >
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Final Invoice</DropdownMenuItem>
          </GenerateSupplierInvoiceDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DeleteVendorOutgoingInvoiceButton({ invoice }: { invoice: ExpenseVendorInvoice }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVendorOutgoingInvoice(invoice.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Vendor invoice deleted");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} size="icon" title="Delete vendor invoice" type="button" variant="ghost">
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="sr-only">Delete vendor invoice</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete vendor invoice {invoice.invoice_number ?? invoice.id}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the vendor invoice record and its PDF file from OneDrive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleDelete}>
            Delete Invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function InvoicesTab({
  canManage,
  initialInvoices,
  initialSupplierInvoices,
  initialVendorOutgoingInvoices,
  orderNumber,
  suppliers,
  tradeId,
  vendors,
  workingExchangeRate,
}: {
  tradeId: string;
  canManage: boolean;
  initialInvoices: ClientInvoice[];
  initialSupplierInvoices: SupplierInvoiceOutgoing[];
  initialVendorOutgoingInvoices: ExpenseVendorInvoice[];
  orderNumber?: string | null;
  suppliers: SupplierOption[];
  vendors: VendorOption[];
  workingExchangeRate?: number | null;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0d1b34]">Client Invoices</h2>
          {canManage ? <GenerateClientInvoiceMenu orderNumber={orderNumber} tradeId={tradeId} /> : null}
        </div>

        {initialInvoices.length ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total (USD)</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        <ClientInvoiceTypeDisplay invoice={invoice} />
                      </TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell>{formatUsd(invoice.total_usd)}</TableCell>
                      <TableCell>
                        {invoice.pdf_onedrive_url ? (
                          <a
                            download
                            className="font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                            href={buildDownloadUrl(invoice.pdf_onedrive_url, `invoice-${invoice.invoice_number}.pdf`)}
                          >
                            Download
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canManage ? <EditClientInvoiceDialog invoice={invoice} /> : null}
                          {canManage ? <SendInvoiceButton invoice={invoice} /> : null}
                          {canManage ? <ClientInvoiceStatusDropdown invoice={invoice} /> : null}
                          {canManage ? <DeleteClientInvoiceButton invoice={invoice} /> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-10 text-sm text-slate-500">No client invoices yet.</CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0d1b34]">Supplier Invoices (Outgoing)</h2>
          {canManage ? (
            <GenerateSupplierInvoiceMenu
              orderNumber={orderNumber}
              suppliers={suppliers}
              tradeId={tradeId}
              workingExchangeRate={workingExchangeRate}
            />
          ) : null}
        </div>

        {initialSupplierInvoices.length ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total (RMB)</TableHead>
                    <TableHead>USD Equiv.</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead>Supplier Ref</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialSupplierInvoices.map((invoice) => {
                    const adjustments = invoice.adjustments ?? [];

                    return (
                      <Fragment key={invoice.id}>
                        <TableRow>
                          <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            <SupplierTypeBadge type={invoice.invoice_type} />
                          </TableCell>
                          <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                          <TableCell>
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell>{formatRmb(invoice.total_rmb)}</TableCell>
                          <TableCell>{invoice.total_usd != null ? formatUsd(invoice.total_usd) : "-"}</TableCell>
                          <TableCell>
                            {invoice.pdf_onedrive_url ? (
                              <a
                                download
                                className="font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                                href={buildDownloadUrl(invoice.pdf_onedrive_url, `invoice-${invoice.invoice_number}.pdf`)}
                              >
                                Download
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <SupplierInvoiceMatchDialog canManage={canManage} invoice={invoice} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canManage ? <EditSupplierInvoiceDialog invoice={invoice} /> : null}
                              {canManage ? <SupplierInvoiceStatusDropdown invoice={invoice} /> : null}
                              {canManage ? <DeleteSupplierInvoiceButton invoice={invoice} /> : null}
                            </div>
                          </TableCell>
                        </TableRow>
                        {invoice.invoice_type === "final" && adjustments.length ? (
                          <TableRow className="bg-slate-50">
                            <TableCell colSpan={9}>
                              <div className="space-y-2 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Adjustments
                                </p>
                                <div className="space-y-1">
                                  {adjustments.map((adjustment) => (
                                    <div
                                      className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                                      key={adjustment.id}
                                    >
                                      <span className="text-[#0d1b34]">{adjustment.description}</span>
                                      <span className="font-medium text-[#0d1b34]">{formatRmb(adjustment.amount_rmb)}</span>
                                    </div>
                                  ))}
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
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-10 text-sm text-slate-500">No supplier invoices yet.</CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0d1b34]">Vendor Invoices (Outgoing)</h2>
          {canManage && vendors.length ? (
            <GenerateVendorOutgoingInvoiceDialog tradeId={tradeId} vendors={vendors} />
          ) : null}
        </div>

        {initialVendorOutgoingInvoices.length ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total (USD)</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialVendorOutgoingInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">{invoice.invoice_number ?? "-"}</TableCell>
                      <TableCell>{invoice.vendor?.name ?? "-"}</TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell>{formatUsd(invoice.amount_usd)}</TableCell>
                      <TableCell>
                        {invoice.pdf_onedrive_url ? (
                          <a
                            download
                            className="font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                            href={buildDownloadUrl(invoice.pdf_onedrive_url, `vendor-invoice-${invoice.id}.pdf`)}
                          >
                            Download
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canManage ? <EditVendorOutgoingInvoiceDialog invoice={invoice} /> : null}
                          {canManage ? <DeleteVendorOutgoingInvoiceButton invoice={invoice} /> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-10 text-sm text-slate-500">No vendor invoices yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
