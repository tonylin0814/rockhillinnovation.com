"use client";

import { FileText, Loader2, PlusCircle, Trash2 } from "lucide-react";
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
import type { InvoiceAdjustmentLine } from "@/types";

type AdjustmentRow = InvoiceAdjustmentLine & { _key: string };

function createAdjustmentRow(): AdjustmentRow {
  return { _key: crypto.randomUUID(), amount_usd: 0, description: "" };
}

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
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);

  function addAdjustment() {
    setAdjustments((prev) => [...prev, createAdjustmentRow()]);
  }

  function removeAdjustment(index: number) {
    setAdjustments((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }

  function updateAdjustment(index: number, field: keyof InvoiceAdjustmentLine, value: string) {
    setAdjustments((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: field === "amount_usd" ? parseFloat(value) || 0 : value } : row
      )
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("adjustment_lines_json", JSON.stringify(adjustments.map(({ _key, ...row }) => row)));

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
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setAdjustments([]);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Generate Deposit Invoice</DialogTitle>
          <DialogDescription>Creates a deposit invoice using the client&apos;s deposit percentage.</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="invoice_number">Invoice Number</Label>
            <Input
              defaultValue={orderNumber ? `${orderNumber}-DEP` : ""}
              disabled={isPending}
              id="invoice_number"
              name="invoice_number"
              placeholder="e.g. MLP-001-DEP"
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

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0d1b34]">Extra Lines</p>
                <p className="text-xs text-slate-500">
                  Optional adjustments added to the deposit total (USD). Use negative amounts for discounts.
                </p>
              </div>
              <Button disabled={isPending} onClick={addAdjustment} size="sm" type="button" variant="outline">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>

            {adjustments.length > 0 ? (
              <div className="space-y-2">
                {adjustments.map((row, index) => (
                  <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]" key={row._key}>
                    <Input
                      disabled={isPending}
                      onChange={(event) => updateAdjustment(index, "description", event.target.value)}
                      placeholder="Description (e.g. Freight)"
                      value={row.description}
                    />
                    <Input
                      disabled={isPending}
                      onChange={(event) => updateAdjustment(index, "amount_usd", event.target.value)}
                      placeholder="$ Amount"
                      step="0.01"
                      type="number"
                      value={row.amount_usd === 0 ? "" : String(row.amount_usd)}
                    />
                    <Button
                      disabled={isPending}
                      onClick={() => removeAdjustment(index)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                      <span className="sr-only">Remove line</span>
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
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
