"use client";

import { Pencil } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { ExpenseVendorInvoice } from "@/types";

function dateInputValue(value: string) {
  return value.slice(0, 10);
}

export function EditVendorOutgoingInvoiceDialog({ invoice }: { invoice: ExpenseVendorInvoice }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" title="Edit vendor invoice" type="button" variant="ghost">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit vendor invoice</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
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
