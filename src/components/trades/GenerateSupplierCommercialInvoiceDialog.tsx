"use client";

import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateSupplierCommercialInvoice } from "@/app/actions/supplier-invoices-outgoing";
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

type SupplierOption = { code: string; id: string; name: string };
type SupplierExtraLine = {
  _key: string;
  description_chinese: string;
  amount_rmb: string;
};

function createSupplierExtraLine(): SupplierExtraLine {
  return {
    _key: crypto.randomUUID(),
    amount_rmb: "",
    description_chinese: "",
  };
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function orderNumberSuffix(orderNumber?: string | null) {
  if (!orderNumber) return "";
  const parts = orderNumber.split("-");
  return parts[parts.length - 1] ?? orderNumber;
}

export function GenerateSupplierCommercialInvoiceDialog({
  children,
  orderNumber,
  suppliers,
  tradeId,
}: {
  children: ReactNode;
  orderNumber?: string | null;
  suppliers: SupplierOption[];
  tradeId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [supplierCode, setSupplierCode] = useState(suppliers[0]?.code ?? "");
  const [extraLines, setExtraLines] = useState<SupplierExtraLine[]>([]);
  const suffix = orderNumberSuffix(orderNumber);
  const generatedInvoiceNumber = supplierCode && suffix ? `${supplierCode}-${suffix}` : "";

  function addExtraLine() {
    setExtraLines((prev) => [...prev, createSupplierExtraLine()]);
  }

  function removeExtraLine(index: number) {
    setExtraLines((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }

  function updateExtraLine(index: number, field: keyof Omit<SupplierExtraLine, "_key">, value: string) {
    setExtraLines((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("invoice_number", generatedInvoiceNumber);

    if (extraLines.length > 0) {
      const payload = extraLines
        .filter((line) => {
          const amount = Number(line.amount_rmb);
          return line.description_chinese.trim() && Number.isFinite(amount) && amount !== 0;
        })
        .map((line) => ({
          amount_rmb: Number(line.amount_rmb),
          description_chinese: line.description_chinese.trim() || null,
          description_english: null,
        }));
      formData.set("extra_lines_json", JSON.stringify(payload));
    }

    startTransition(async () => {
      const result = await generateSupplierCommercialInvoice(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Commercial invoice generated");
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
          setExtraLines([]);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Generate Supplier Commercial Invoice</DialogTitle>
          <DialogDescription>Includes all non-set supplier quote items at 100%.</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="sup_commercial_inv_num">Invoice Number</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
              <Select disabled={isPending} onValueChange={setSupplierCode} value={supplierCode}>
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
              <div className="flex items-center justify-center text-sm text-slate-400">-</div>
              <Input disabled id="sup_commercial_inv_num" placeholder="Order number" value={suffix} />
            </div>
            <input name="invoice_number" type="hidden" value={generatedInvoiceNumber} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup_commercial_inv_date">Invoice Date</Label>
            <Input
              defaultValue={todayInputValue()}
              disabled={isPending}
              id="sup_commercial_inv_date"
              name="invoice_date"
              required
              type="date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup_commercial_notes">Notes</Label>
            <Textarea disabled={isPending} id="sup_commercial_notes" name="notes" />
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0d1b34]">Extra Lines</p>
                <p className="text-xs text-slate-500">Optional additional items appended to this invoice (RMB).</p>
              </div>
              <Button disabled={isPending} onClick={addExtraLine} size="sm" type="button" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>

            {extraLines.length > 0 ? (
              <div className="space-y-2">
                {extraLines.map((line, index) => (
                  <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]" key={line._key}>
                    <Input
                      disabled={isPending}
                      lang="zh"
                      onChange={(event) => updateExtraLine(index, "description_chinese", event.target.value)}
                      placeholder="描述"
                      style={{ fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" }}
                      type="text"
                      value={line.description_chinese}
                    />
                    <Input
                      disabled={isPending}
                      onChange={(event) => updateExtraLine(index, "amount_rmb", event.target.value)}
                      placeholder="¥ Amount (negative for discount)"
                      step="any"
                      type="number"
                      value={line.amount_rmb}
                    />
                    <Button
                      disabled={isPending}
                      onClick={() => removeExtraLine(index)}
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
