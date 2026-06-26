"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateVendorOutgoingInvoice } from "@/app/actions/vendor-invoices";
import { Button } from "@/components/ui/button";
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
import type { ExpenseVendorInvoice } from "@/types";

function dateInputValue(value: string) {
  return value.slice(0, 10);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

export function EditVendorOutgoingInvoiceDialog({ invoice }: { invoice: ExpenseVendorInvoice }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState(() =>
    (invoice.lines?.length ? invoice.lines : [{ amount_usd: invoice.amount_usd, description: invoice.description ?? "" }]).map(
      (line, index) => ({
        _key: `${invoice.id}-${index}`,
        amount_usd: String(line.amount_usd ?? 0),
        description: line.description ?? "",
      })
    )
  );

  function handleOpenChange(value: boolean) {
    setOpen(value);

    if (value) {
      setLines(
        (invoice.lines?.length ? invoice.lines : [{ amount_usd: invoice.amount_usd, description: invoice.description ?? "" }]).map(
          (line, index) => ({
            _key: `${invoice.id}-${index}`,
            amount_usd: String(line.amount_usd ?? 0),
            description: line.description ?? "",
          })
        )
      );
    }
  }

  function updateLine(index: number, field: "amount_usd" | "description", value: string) {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line))
    );
  }

  function addLine() {
    setLines((currentLines) => [...currentLines, { _key: crypto.randomUUID(), amount_usd: "0", description: "" }]);
  }

  function removeLine(index: number) {
    setLines((currentLines) => currentLines.filter((_, lineIndex) => lineIndex !== index));
  }

  const lineTotal = lines.reduce((sum, line) => sum + (Number(line.amount_usd) || 0), 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
      const result = await updateVendorOutgoingInvoice(invoice.id, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Vendor invoice updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" title="Edit vendor invoice" type="button" variant="ghost">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit vendor invoice</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Vendor Invoice</DialogTitle>
          <DialogDescription>Update invoice details. This does not regenerate the PDF file.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`vendor_invoice_number_${invoice.id}`}>Invoice Number</Label>
              <Input
                defaultValue={invoice.invoice_number ?? ""}
                disabled={isPending}
                id={`vendor_invoice_number_${invoice.id}`}
                name="invoice_number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`vendor_invoice_status_${invoice.id}`}>Status</Label>
              <Select defaultValue={invoice.status} disabled={isPending} name="status">
                <SelectTrigger id={`vendor_invoice_status_${invoice.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`vendor_invoice_date_${invoice.id}`}>Invoice Date</Label>
              <Input
                defaultValue={dateInputValue(invoice.invoice_date)}
                disabled={isPending}
                id={`vendor_invoice_date_${invoice.id}`}
                name="invoice_date"
                required
                type="date"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`vendor_invoice_notes_${invoice.id}`}>Notes</Label>
            <Textarea
              defaultValue={invoice.notes ?? ""}
              disabled={isPending}
              id={`vendor_invoice_notes_${invoice.id}`}
              name="notes"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0d1b34]">Vendor Invoice Detail Lines</p>
                <p className="text-xs text-slate-500">These line edits update the invoice total, but do not regenerate the PDF.</p>
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
                    <TableHead className="min-w-[300px]">Description</TableHead>
                    <TableHead className="w-40">Amount (USD)</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
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
                          min="0"
                          onChange={(event) => updateLine(index, "amount_usd", event.currentTarget.value)}
                          step="0.01"
                          type="number"
                          value={line.amount_usd}
                        />
                      </TableCell>
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
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="font-semibold">{formatUsd(lineTotal)}</TableCell>
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
