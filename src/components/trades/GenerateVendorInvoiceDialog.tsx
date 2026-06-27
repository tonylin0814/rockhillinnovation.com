"use client";

import { FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateVendorInvoice } from "@/app/actions/vendor-invoices";
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
import { Textarea } from "@/components/ui/textarea";
import type { TradeShareholder } from "@/types";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function GenerateVendorInvoiceDialog({
  shareholder,
  tradeId,
}: {
  tradeId: string;
  shareholder: TradeShareholder;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const vendorName = shareholder.expense_vendor?.name ?? "Vendor";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await generateVendorInvoice(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Vendor invoice generated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Generate Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Generate Vendor Invoice</DialogTitle>
          <DialogDescription>
            {shareholder.person_name} - via {vendorName}
            {shareholder.expense_vendor?.letterhead_onedrive_url
              ? " - Letterhead will be applied"
              : " - No letterhead configured"}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <input name="shareholder_id" type="hidden" value={shareholder.id} />

          <div className="space-y-2">
            <Label htmlFor="vi_invoice_number">Invoice Number (optional)</Label>
            <Input disabled={isPending} id="vi_invoice_number" name="invoice_number" placeholder="VND-001" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vi_invoice_date">Invoice Date</Label>
            <Input
              defaultValue={todayInputValue()}
              disabled={isPending}
              id="vi_invoice_date"
              name="invoice_date"
              required
              type="date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vi_amount_usd">Amount (USD)</Label>
            <Input
              disabled={isPending}
              id="vi_amount_usd"
              min="0.01"
              name="amount_usd"
              placeholder="0.00"
              required
              step="0.01"
              type="number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vi_description">Description</Label>
            <Input
              disabled={isPending}
              id="vi_description"
              name="description"
              placeholder="Consulting services for trade..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vi_notes">Notes</Label>
            <Textarea disabled={isPending} id="vi_notes" name="notes" />
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
