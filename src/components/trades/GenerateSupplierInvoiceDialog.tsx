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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type InvoiceKind = "deposit" | "final";
type SupplierOption = { code: string; id: string; name: string };
type FinalLine = {
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
  final: "Enter each final invoice line manually.",
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function orderNumberSuffix(orderNumber?: string | null) {
  if (!orderNumber) return "";
  const parts = orderNumber.split("-");
  return parts[parts.length - 1] ?? orderNumber;
}

function formatRmb(value: number) {
  return `\u00A5${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

export function GenerateSupplierInvoiceDialog({
  children,
  orderNumber,
  suppliers,
  tradeId,
  type,
}: {
  orderNumber?: string | null;
  suppliers: SupplierOption[];
  tradeId: string;
  type: InvoiceKind;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [finalLines, setFinalLines] = useState<FinalLine[]>([
    { _key: "final-line-1", amount_rmb: "", description: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [supplierCode, setSupplierCode] = useState(suppliers[0]?.code ?? "");
  const label = dialogLabels[type];
  const finalTotal = finalLines.reduce((sum, line) => sum + (Number(line.amount_rmb) || 0), 0);
  const suffix = orderNumberSuffix(orderNumber);
  const generatedInvoiceNumber = supplierCode && suffix ? `${supplierCode}-${suffix}` : "";
  const [invoiceNumber, setInvoiceNumber] = useState(generatedInvoiceNumber);

  function handleOpenChange(value: boolean) {
    setOpen(value);

    if (value) {
      setError(null);
      setInvoiceNumber(generatedInvoiceNumber);
    }
  }

  function handleSupplierChange(value: string) {
    setSupplierCode(value);
    setInvoiceNumber(value && suffix ? `${value}-${suffix}` : "");
  }

  function addFinalLine() {
    setFinalLines((currentLines) => [
      ...currentLines,
      { _key: crypto.randomUUID(), amount_rmb: "", description: "" },
    ]);
  }

  function updateFinalLine(index: number, field: keyof Omit<FinalLine, "_key">, value: string) {
    setFinalLines((currentLines) =>
      currentLines.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line))
    );
  }

  function removeFinalLine(index: number) {
    setFinalLines((currentLines) => currentLines.filter((_, lineIndex) => lineIndex !== index));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    if (type === "final") {
      const finalPayload = finalLines
        .filter((line) => line.description.trim() && Number(line.amount_rmb) > 0)
        .map((line) => ({ amount_rmb: Number(line.amount_rmb), description: line.description.trim() }));
      formData.set("final_lines_json", JSON.stringify(finalPayload));
    }

    startTransition(async () => {
      const result = await generateSupplierInvoiceOutgoing(tradeId, formData, type);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(`${label} invoice generated`);
      setOpen(false);
      setFinalLines([{ _key: "final-line-1", amount_rmb: "", description: "" }]);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate {label} Invoice</DialogTitle>
          <DialogDescription>{descriptions[type]}</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`sup_${type}_inv_num`}>Invoice Number</Label>
            <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
              <Select disabled={isPending} onValueChange={handleSupplierChange} value={supplierCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.code}>
                      {supplier.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                disabled={isPending}
                id={`sup_${type}_inv_num`}
                name="invoice_number"
                onChange={(event) => setInvoiceNumber(event.currentTarget.value)}
                placeholder={generatedInvoiceNumber || "Invoice number"}
                required
                value={invoiceNumber}
              />
            </div>
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
                  <p className="text-sm font-semibold text-[#0d1b34]">Invoice Lines</p>
                  <p className="text-xs text-slate-500">Enter each item and its RMB amount for this final invoice.</p>
                </div>
                <Button
                  disabled={isPending}
                  onClick={addFinalLine}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-2">
                {finalLines.map((line, index) => (
                  <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]" key={line._key}>
                    <Input
                      disabled={isPending}
                      onChange={(event) => updateFinalLine(index, "description", event.target.value)}
                      placeholder="Description"
                      required
                      value={line.description}
                    />
                    <Input
                      disabled={isPending}
                      min="0.01"
                      onChange={(event) => updateFinalLine(index, "amount_rmb", event.target.value)}
                      placeholder="\u00A5 Amount"
                      required
                      step="0.01"
                      type="number"
                      value={line.amount_rmb}
                    />
                    <Button
                      disabled={isPending || finalLines.length === 1}
                      onClick={() => removeFinalLine(index)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove invoice line</span>
                    </Button>
                  </div>
                ))}
              </div>

              <p className="text-sm font-medium text-[#0d1b34]">Total: {formatRmb(finalTotal)}</p>
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
