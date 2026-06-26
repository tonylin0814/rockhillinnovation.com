"use client";

import { FileText, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateFinalInvoice, getTradeRemainingBalance } from "@/app/actions/invoices";
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
type BalanceState = { depositsPaid: number; finalInvoiceCount: number; remaining: number; subtotal: number } | null;

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function createAdjustmentRow(): AdjustmentRow {
  return {
    _key: crypto.randomUUID(),
    amount_usd: 0,
    description: "",
  };
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

export function GenerateAdditionalInvoiceDialog({
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
  const [balance, setBalance] = useState<BalanceState>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setBalance(null);
    setBalanceError(null);

    getTradeRemainingBalance(tradeId).then((result) => {
      if (cancelled) return;

      if ("error" in result) {
        setBalanceError(result.error);
        return;
      }

      setBalance(result);
      const suffix = result.finalInvoiceCount === 0 ? "BAL" : `BAL-${result.finalInvoiceCount + 1}`;
      setInvoiceNumber(orderNumber ? `${orderNumber}-${suffix}` : suffix);
    });

    return () => {
      cancelled = true;
    };
  }, [open, orderNumber, tradeId]);

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

  function handleOpenChange(value: boolean) {
    setOpen(value);

    if (!value) {
      setAdjustments([]);
      setError(null);
      setInvoiceNumber("");
    }
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
      const result = await generateFinalInvoice(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Invoice generated");
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Final / Additional Invoice</DialogTitle>
          <DialogDescription>Creates a balance invoice with optional extra charges or credits.</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="additional_display_label">Display Label</Label>
            <Input
              disabled={isPending}
              id="additional_display_label"
              name="display_label"
              placeholder="e.g. Final Invoice, 2nd Invoice"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice_number">Invoice Number</Label>
            <Input
              disabled={isPending}
              id="invoice_number"
              name="invoice_number"
              onChange={(event) => setInvoiceNumber(event.target.value)}
              placeholder="e.g. MLP-001-BAL"
              required
              value={invoiceNumber}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional_invoice_date">Invoice Date</Label>
            <Input
              defaultValue={todayInputValue()}
              disabled={isPending}
              id="additional_invoice_date"
              name="invoice_date"
              required
              type="date"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            {balance ? (
              <div className="space-y-1">
                <p className="font-semibold text-[#0d1b34]">Remaining balance: {formatUsd(balance.remaining)}</p>
                <p className="text-xs text-slate-500">
                  Order subtotal {formatUsd(balance.subtotal)} - deposits {formatUsd(balance.depositsPaid)}
                </p>
              </div>
            ) : balanceError ? (
              <p className="font-medium text-red-600">{balanceError}</p>
            ) : (
              <p className="text-slate-500">Loading remaining balance...</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Additional Lines</Label>
              <Button disabled={isPending} onClick={addAdjustment} size="sm" type="button" variant="outline">
                <PlusCircle className="mr-1 h-3.5 w-3.5" />
                Add Line
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add extra charges (positive) or credits/deductions (negative). The remaining balance above is always
              included.
            </p>

            {adjustments.length ? (
              <div className="space-y-2 rounded-md border p-3">
                {adjustments.map((adjustment, index) => (
                  <div className="flex items-start gap-2" key={adjustment._key}>
                    <Input
                      disabled={isPending}
                      onChange={(event) => updateAdjustment(index, "description", event.target.value)}
                      placeholder="Description"
                      value={adjustment.description}
                    />
                    <Input
                      className="w-28"
                      disabled={isPending}
                      onChange={(event) => updateAdjustment(index, "amount_usd", event.target.value)}
                      placeholder="Amount"
                      step="0.01"
                      type="number"
                      value={adjustment.amount_usd === 0 ? "" : adjustment.amount_usd}
                    />
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
            <Label htmlFor="additional_invoice_notes">Notes</Label>
            <Textarea disabled={isPending} id="additional_invoice_notes" name="notes" rows={3} />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => handleOpenChange(false)} type="button" variant="outline">
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
