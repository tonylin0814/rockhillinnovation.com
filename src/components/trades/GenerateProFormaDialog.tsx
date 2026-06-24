"use client";

import { FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateDepositInvoice, generateFinalInvoice, generateProForma } from "@/app/actions/invoices";
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
import type { ClientInvoice } from "@/types";

type InvoiceType = Exclude<ClientInvoice["invoice_type"], "commercial">;

const dialogLabels: Record<InvoiceType, string> = {
  deposit: "Deposit",
  final: "Final",
  pro_forma: "Pro-Forma",
};

const invoiceNumberHints: Record<InvoiceType, string> = {
  deposit: "Enter base number, -D will be added",
  final: "Final invoice uses this number",
  pro_forma: "MLP-042826",
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

async function runInvoiceAction(type: InvoiceType, tradeId: string, formData: FormData) {
  if (type === "deposit") {
    return generateDepositInvoice(tradeId, formData);
  }

  if (type === "final") {
    return generateFinalInvoice(tradeId, formData);
  }

  return generateProForma(tradeId, formData);
}

export function GenerateInvoiceDialog({
  children,
  tradeId,
  type,
}: {
  tradeId: string;
  type: InvoiceType;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const label = dialogLabels[type];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await runInvoiceAction(type, tradeId, formData);

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate {label} Invoice</DialogTitle>
          <DialogDescription>Create a PDF invoice from this trade order lines.</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${type}_invoice_number`}>Invoice Number</Label>
            <Input
              disabled={isPending}
              id={`${type}_invoice_number`}
              name="invoice_number"
              placeholder={invoiceNumberHints[type]}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${type}_invoice_date`}>Invoice Date</Label>
              <Input
                defaultValue={todayInputValue()}
                disabled={isPending}
                id={`${type}_invoice_date`}
                name="invoice_date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}_due_date`}>Due Date</Label>
              <Input disabled={isPending} id={`${type}_due_date`} name="due_date" type="date" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${type}_invoice_notes`}>Notes</Label>
            <Textarea disabled={isPending} id={`${type}_invoice_notes`} name="notes" />
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
