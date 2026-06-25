"use client";

import { FileText, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateSupplierInvoiceOutgoing } from "@/app/actions/supplier-invoices-outgoing";
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

type InvoiceKind = "deposit" | "final";
type AdjustmentLine = {
  _key: string;
  amount_rmb: string;
  description: string;
};

const dialogLabels: Record<InvoiceKind, string> = {
  deposit: "Supplier Deposit",
  final: "Supplier Final",
};

const descriptions: Record<InvoiceKind, string> = {
  deposit: "Includes outsourced items at 100% and produced items at 50%.",
  final: "Includes produced items at 50% (remaining) and all misc expenses at 100%.",
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatRmb(value: number) {
  return `\u00A5${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

export function GenerateSupplierInvoiceDialog({
  children,
  tradeId,
  type,
}: {
  tradeId: string;
  type: InvoiceKind;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adjustments, setAdjustments] = useState<AdjustmentLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const label = dialogLabels[type];
  const adjustmentTotal = adjustments.reduce((sum, adjustment) => sum + (Number(adjustment.amount_rmb) || 0), 0);

  function updateAdjustment(index: number, field: keyof AdjustmentLine, value: string) {
    setAdjustments((currentAdjustments) =>
      currentAdjustments.map((adjustment, adjustmentIndex) =>
        adjustmentIndex === index ? { ...adjustment, [field]: value } : adjustment
      )
    );
  }

  function removeAdjustment(index: number) {
    setAdjustments((currentAdjustments) =>
      currentAdjustments.filter((_, adjustmentIndex) => adjustmentIndex !== index)
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const adjustmentPayload = adjustments
      .map((adjustment) => ({
        amount_rmb: Number(adjustment.amount_rmb),
        description: adjustment.description.trim(),
      }))
      .filter((adjustment) => adjustment.description && adjustment.amount_rmb > 0);

    formData.set("adjustments_json", JSON.stringify(type === "final" ? adjustmentPayload : []));

    startTransition(async () => {
      const result = await generateSupplierInvoiceOutgoing(tradeId, formData, type);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(`${label} invoice generated`);
      setOpen(false);
      setAdjustments([]);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate {label} Invoice</DialogTitle>
          <DialogDescription>{descriptions[type]}</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`sup_${type}_inv_num`}>Invoice Number</Label>
            <Input
              disabled={isPending}
              id={`sup_${type}_inv_num`}
              name="invoice_number"
              placeholder={type === "deposit" ? "RH-001-SI-D" : "RH-001-SI-F"}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`sup_${type}_inv_date`}>Invoice Date</Label>
            <Input
              defaultValue={todayInputValue()}
              disabled={isPending}
              id={`sup_${type}_inv_date`}
              name="invoice_date"
              required
              type="date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`sup_${type}_notes`}>Notes</Label>
            <Textarea disabled={isPending} id={`sup_${type}_notes`} name="notes" />
          </div>

          {type === "final" ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0d1b34]">Adjustment Lines</p>
                  <p className="text-xs text-slate-500">Unexpected production costs added to this final invoice.</p>
                </div>
                <Button
                  disabled={isPending}
                  onClick={() =>
                    setAdjustments((currentAdjustments) => [
                      ...currentAdjustments,
                      { _key: crypto.randomUUID(), amount_rmb: "", description: "" },
                    ])
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Adjustment Line
                </Button>
              </div>

              {adjustments.length ? (
                <div className="space-y-2">
                  {adjustments.map((adjustment, index) => (
                    <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]" key={adjustment._key}>
                      <Input
                        disabled={isPending}
                        onChange={(event) => updateAdjustment(index, "description", event.target.value)}
                        placeholder="Description"
                        required
                        value={adjustment.description}
                      />
                      <Input
                        disabled={isPending}
                        min="0.01"
                        onChange={(event) => updateAdjustment(index, "amount_rmb", event.target.value)}
                        placeholder="RMB"
                        required
                        step="0.01"
                        type="number"
                        value={adjustment.amount_rmb}
                      />
                      <Button
                        disabled={isPending}
                        onClick={() => removeAdjustment(index)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remove adjustment line</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No adjustment lines added.</p>
              )}

              <p className="text-sm font-medium text-[#0d1b34]">
                Base amount: calculated from confirmed quote + Adjustments: {formatRmb(adjustmentTotal)} = Total:
                base + {formatRmb(adjustmentTotal)}
              </p>
            </div>
          ) : null}

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
