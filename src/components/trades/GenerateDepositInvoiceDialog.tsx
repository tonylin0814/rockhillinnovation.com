"use client";

import { FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateDepositInvoice } from "@/app/actions/invoices";
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

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function GenerateDepositInvoiceDialog({
  children,
  orderNumber,
  tradeId,
}: {
  children: ReactNode;
  orderNumber?: string | null;
  tradeId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await generateDepositInvoice(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Deposit invoice generated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Deposit Invoice</DialogTitle>
          <DialogDescription>Creates a deposit invoice using the client&apos;s deposit percentage.</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="deposit_invoice_number">Invoice Number</Label>
            <Input
              defaultValue={orderNumber ?? ""}
              disabled={isPending}
              id="deposit_invoice_number"
              name="invoice_number"
              readOnly
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deposit_invoice_date">Invoice Date</Label>
            <Input
              defaultValue={todayInputValue()}
              disabled={isPending}
              id="deposit_invoice_date"
              name="invoice_date"
              required
              type="date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deposit_invoice_notes">Notes</Label>
            <Textarea disabled={isPending} id="deposit_invoice_notes" name="notes" rows={3} />
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
