"use client";

import { FileText, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateVendorOutgoingInvoice } from "@/app/actions/vendor-invoices";
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

type VendorOption = { id: string; code: string; name: string };
type LineState = { description: string; amount_usd: string };

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function GenerateVendorOutgoingInvoiceDialog({
  tradeId,
  vendors,
}: {
  tradeId: string;
  vendors: VendorOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [lines, setLines] = useState<LineState[]>([{ amount_usd: "", description: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((currentLines) => currentLines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((currentLines) => [...currentLines, { amount_usd: "", description: "" }]);
  }

  function removeLine(index: number) {
    setLines((currentLines) => currentLines.filter((_, lineIndex) => lineIndex !== index));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("vendor_id", vendorId);
    formData.set(
      "lines",
      JSON.stringify(
        lines.map((line) => ({
          amount_usd: Number(line.amount_usd),
          description: line.description,
        }))
      )
    );

    startTransition(async () => {
      const result = await generateVendorOutgoingInvoice(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Vendor invoice generated");
      setOpen(false);
      setLines([{ amount_usd: "", description: "" }]);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Generate Vendor Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Vendor Invoice</DialogTitle>
          <DialogDescription>Create a vendor invoice with one or more USD line items.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor_id">Vendor</Label>
              <Select disabled={isPending} onValueChange={setVendorId} required value={vendorId}>
                <SelectTrigger id="vendor_id">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.code} - {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor_invoice_number">Invoice Number</Label>
              <Input disabled={isPending} id="vendor_invoice_number" name="invoice_number" placeholder="VND-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor_invoice_date">Invoice Date</Label>
              <Input
                defaultValue={todayInputValue()}
                disabled={isPending}
                id="vendor_invoice_date"
                name="invoice_date"
                required
                type="date"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button disabled={isPending} onClick={addLine} size="sm" type="button" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>
            {lines.map((line, index) => (
              <div className="grid gap-2 sm:grid-cols-[1fr_150px_40px]" key={index}>
                <Input
                  disabled={isPending}
                  onChange={(event) => updateLine(index, { description: event.currentTarget.value })}
                  placeholder="Description"
                  required
                  value={line.description}
                />
                <Input
                  disabled={isPending}
                  min="0.01"
                  onChange={(event) => updateLine(index, { amount_usd: event.currentTarget.value })}
                  placeholder="Amount"
                  required
                  step="0.01"
                  type="number"
                  value={line.amount_usd}
                />
                <Button
                  disabled={isPending || lines.length === 1}
                  onClick={() => removeLine(index)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor_invoice_notes">Notes</Label>
            <Textarea disabled={isPending} id="vendor_invoice_notes" name="notes" />
          </div>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Generate
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
