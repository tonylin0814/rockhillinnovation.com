"use client";

import { CheckCircle2, Link2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { matchSupplierInvoice } from "@/app/actions/supplier-invoices-outgoing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SupplierInvoiceOutgoing } from "@/types";

function formatRmb(value: number) {
  return `\u00A5${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

function MatchBadge({ invoice }: { invoice: SupplierInvoiceOutgoing }) {
  if (!invoice.supplier_stated_amount_rmb) {
    return (
      <Badge className="border-slate-200 bg-slate-100 text-slate-500" variant="outline">
        Unverified
      </Badge>
    );
  }

  const diff = Number(invoice.supplier_stated_amount_rmb) - Number(invoice.total_rmb);
  const matched = Math.abs(diff) <= 0.01;

  if (matched) {
    return (
      <Badge className="border-green-200 bg-green-50 text-green-700" variant="outline">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Matched
      </Badge>
    );
  }

  const sign = diff > 0 ? "+" : "";

  return (
    <Badge className="border-red-200 bg-red-50 text-red-700" variant="outline">
      <XCircle className="mr-1 h-3 w-3" />
      {sign}
      {diff < 0 ? "-" : ""}
      {formatRmb(Math.abs(diff))}
    </Badge>
  );
}

export function SupplierInvoiceMatchDialog({
  canManage,
  invoice,
}: {
  canManage: boolean;
  invoice: SupplierInvoiceOutgoing;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formRef.current) {
      return;
    }

    const formData = new FormData(formRef.current);

    startTransition(async () => {
      const result = await matchSupplierInvoice(invoice.id, formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Invoice matched");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <MatchBadge invoice={invoice} />
      {canManage ? (
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>
            <Button size="icon" title="Enter supplier invoice reference" type="button" variant="ghost">
              <Link2 className="h-4 w-4" />
              <span className="sr-only">Match supplier invoice</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Match Supplier Invoice</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-500">
              Enter the reference and amount from the supplier&apos;s own invoice to verify it matches our outgoing
              record (<span className="font-mono font-medium">{invoice.invoice_number}</span>, expected{" "}
              <span className="font-medium">{formatRmb(Number(invoice.total_rmb))}</span>).
            </p>
            <form className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
              <div className="space-y-1.5">
                <Label htmlFor="supplier_invoice_ref">Supplier Invoice Number</Label>
                <Input
                  defaultValue={invoice.supplier_invoice_ref ?? ""}
                  id="supplier_invoice_ref"
                  name="supplier_invoice_ref"
                  placeholder="e.g. INV-2024-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier_stated_amount_rmb">Supplier Stated Amount (RMB)</Label>
                <Input
                  defaultValue={invoice.supplier_stated_amount_rmb ?? ""}
                  id="supplier_stated_amount_rmb"
                  min="0.01"
                  name="supplier_stated_amount_rmb"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
                  Save
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
