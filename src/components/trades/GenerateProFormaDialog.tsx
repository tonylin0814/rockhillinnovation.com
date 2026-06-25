"use client";

import { FileText, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateCommercialInvoice } from "@/app/actions/invoices";
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
  return {
    _key: crypto.randomUUID(),
    amount_usd: 0,
    description: "",
  };
}

export function GenerateInvoiceDialog({
  children,
  tradeId,
}: {
  tradeId: string;
  type?: unknown;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);

  function addAdjustment() {
    setAdjustments((previousAdjustments) => [...previousAdjustments, createAdjustmentRow()]);
  }

  function removeAdjustment(index: number) {
    setAdjustments((previousAdjustments) => previousAdjustments.filter((_, adjustmentIndex) => adjustmentIndex !== index));
  }

  function updateAdjustment(index: number, field: keyof InvoiceAdjustmentLine, value: string) {
    setAdjustments((previousAdjustments) =>
      previousAdjustments.map((adjustment, adjustmentIndex) =>
        adjustmentIndex === index
          ? { ...adjustment, [field]: field === "amount_usd" ? parseFloat(value) || 0 : value }
          : adjustment
      )
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set(
      "adjustment_lines_json",
      JSON.stringify(adjustments.map(({ _key, ...adjustment }) => adjustment))
    );

    startTransition(async () => {
      const result = await generateCommercialInvoice(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Invoice generated");
      setOpen(false);
      setAdjustments([]);
      router.refresh();
    });
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);

    if (!value) {
      setAdjustments([]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Commercial Invoice</DialogTitle>
          <DialogDescription>
            Creates a single invoice with full order total and payment schedule.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="invoice_number">Invoice Number</Label>
            <Input
              disabled={isPending}
              id="invoice_number"
              name="invoice_number"
              placeholder="e.g. MLP-042826"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice Date</Label>
              <Input
                defaultValue={new Date().toISOString().slice(0, 10)}
                disabled={isPending}
                id="invoice_date"
                name="invoice_date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit_pct">Deposit %</Label>
              <Input
                defaultValue="50"
                disabled={isPending}
                id="deposit_pct"
                max="100"
                min="0"
                name="deposit_pct"
                step="1"
                type="number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deposit_due_date">Deposit Due Date</Label>
            <Input disabled={isPending} id="deposit_due_date" name="deposit_due_date" type="date" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_terms">Balance Due</Label>
            <Input
              defaultValue="Prior to shipment"
              disabled={isPending}
              id="payment_terms"
              name="payment_terms"
              placeholder="e.g. Prior to shipment"
            />
            <p className="text-xs text-muted-foreground">Shown as the due condition for the balance milestone.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Adjustment Lines</Label>
              <Button disabled={isPending} onClick={addAdjustment} size="sm" type="button" variant="outline">
                <PlusCircle className="mr-1 h-3.5 w-3.5" />
                Add Line
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use for overpayments, credits, or any amount that revises the grand total. Negative = credit, positive =
              additional charge.
            </p>

            {adjustments.length > 0 ? (
              <div className="space-y-2 rounded-md border p-3">
                {adjustments.map((adjustment, index) => (
                  <div className="flex items-start gap-2" key={adjustment._key}>
                    <div className="flex-1">
                      <Input
                        disabled={isPending}
                        onChange={(event) => updateAdjustment(index, "description", event.target.value)}
                        placeholder="e.g. Overpayment received - $1,179 credit"
                        value={adjustment.description}
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        disabled={isPending}
                        onChange={(event) => updateAdjustment(index, "amount_usd", event.target.value)}
                        placeholder="Amount"
                        step="0.01"
                        type="number"
                        value={adjustment.amount_usd === 0 ? "" : adjustment.amount_usd}
                      />
                    </div>
                    <Button
                      disabled={isPending}
                      onClick={() => removeAdjustment(index)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice_notes">Notes</Label>
            <Textarea disabled={isPending} id="invoice_notes" name="notes" rows={2} />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => handleOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              {isPending ? "Generating..." : "Generate Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
