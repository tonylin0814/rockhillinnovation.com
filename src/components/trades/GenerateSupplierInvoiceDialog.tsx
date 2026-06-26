"use client";

import { FileText, Loader2 } from "lucide-react";
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

const dialogLabels: Record<InvoiceKind, string> = {
  deposit: "Supplier Deposit",
  final: "Supplier Final",
};

const descriptions: Record<InvoiceKind, string> = {
  deposit: "Outsourced items are billed at 100%; produced items at 50%.",
  final: "Remaining 50% of produced items, auto-calculated from the confirmed quote.",
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function orderNumberSuffix(orderNumber?: string | null) {
  if (!orderNumber) return "";
  const parts = orderNumber.split("-");
  return parts[parts.length - 1] ?? orderNumber;
}

export function GenerateSupplierInvoiceDialog({
  children,
  orderNumber,
  suppliers,
  tradeId,
  type,
  workingExchangeRate,
}: {
  orderNumber?: string | null;
  suppliers: SupplierOption[];
  tradeId: string;
  type: InvoiceKind;
  workingExchangeRate?: number | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [supplierCode, setSupplierCode] = useState(suppliers[0]?.code ?? "");
  const label = dialogLabels[type];
  const suffix = orderNumberSuffix(orderNumber);
  const generatedInvoiceNumber = supplierCode && suffix ? `${supplierCode}-${suffix}` : "";
  const [invoiceNumber, setInvoiceNumber] = useState(generatedInvoiceNumber);
  const [exchangeRate, setExchangeRate] = useState<string>(
    workingExchangeRate != null ? String(workingExchangeRate) : ""
  );

  function handleOpenChange(value: boolean) {
    setOpen(value);

    if (value) {
      setError(null);
      setInvoiceNumber(generatedInvoiceNumber);
      setExchangeRate(workingExchangeRate != null ? String(workingExchangeRate) : "");
    }
  }

  function handleSupplierChange(value: string) {
    setSupplierCode(value);
    setInvoiceNumber(value && suffix ? `${value}-${suffix}` : "");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await generateSupplierInvoiceOutgoing(tradeId, formData, type);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(`${label} invoice generated`);
      setOpen(false);
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
            <Label htmlFor={`sup_${type}_rate`}>Agreed Exchange Rate (RMB / USD)</Label>
            <Input
              disabled={isPending}
              id={`sup_${type}_rate`}
              min="0.0001"
              name="exchange_rate"
              onChange={(event) => setExchangeRate(event.currentTarget.value)}
              placeholder="e.g. 7.2500"
              step="0.0001"
              type="number"
              value={exchangeRate}
            />
            <p className="text-xs text-slate-500">Leave blank to use the rate saved in Financial settings.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`sup_${type}_notes`}>Notes</Label>
            <Textarea disabled={isPending} id={`sup_${type}_notes`} name="notes" />
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
