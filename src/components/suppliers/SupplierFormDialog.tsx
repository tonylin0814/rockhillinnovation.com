"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createSupplier, updateSupplier } from "@/app/actions/suppliers";
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
import type { Supplier } from "@/types";

type SupplierFormDialogProps = {
  mode: "create" | "edit";
  initialData?: Supplier;
  trigger?: ReactNode;
};

export function SupplierFormDialog({ mode, initialData, trigger }: SupplierFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceFormat, setInvoiceFormat] = useState<Supplier["invoice_format"]>(
    initialData?.invoice_format ?? "image"
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setError(null);
      setInvoiceFormat(initialData?.invoice_format ?? "image");
    }
  }, [initialData, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("invoice_format", invoiceFormat);

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createSupplier(formData)
          : await updateSupplier(initialData?.id ?? "", formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      toast.success(mode === "create" ? "Supplier created successfully" : "Supplier updated successfully");
      router.refresh();

      if (mode === "create" && result.id) {
        router.push(`/suppliers/${result.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Supplier" : "Edit Supplier"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create a new supplier profile." : "Update this supplier profile."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Supplier Code</Label>
              <Input
                className="uppercase"
                defaultValue={initialData?.code ?? ""}
                disabled={isPending}
                id="code"
                name="code"
                onChange={(event) => {
                  event.currentTarget.value = event.currentTarget.value.toUpperCase();
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">English Name</Label>
              <Input defaultValue={initialData?.name ?? ""} disabled={isPending} id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_chinese">Chinese Name</Label>
              <Input
                defaultValue={initialData?.name_chinese ?? ""}
                disabled={isPending}
                id="name_chinese"
                name="name_chinese"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input defaultValue={initialData?.country ?? ""} disabled={isPending} id="country" name="country" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                defaultValue={initialData?.website ?? ""}
                disabled={isPending}
                id="website"
                name="website"
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">TEL</Label>
              <Input defaultValue={initialData?.tel ?? ""} disabled={isPending} id="tel" name="tel" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="invoice_format">Invoice Format</Label>
              <Select
                disabled={isPending}
                onValueChange={(value: Supplier["invoice_format"]) => setInvoiceFormat(value)}
                value={invoiceFormat}
              >
                <SelectTrigger id="invoice_format">
                  <SelectValue placeholder="Select invoice format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea defaultValue={initialData?.address ?? ""} disabled={isPending} id="address" name="address" />
          </div>

          <div className="space-y-4 rounded-lg border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-semibold text-[#0d1b34]">Banking Information</h3>
              <p className="mt-1 text-xs text-slate-500">Optional supplier payment details.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bank_account_name">Account Name</Label>
                <Input
                  defaultValue={initialData?.bank_account_name ?? ""}
                  disabled={isPending}
                  id="bank_account_name"
                  name="bank_account_name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_account_number">Account Number</Label>
                <Input
                  defaultValue={initialData?.bank_account_number ?? ""}
                  disabled={isPending}
                  id="bank_account_number"
                  name="bank_account_number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  defaultValue={initialData?.bank_name ?? ""}
                  disabled={isPending}
                  id="bank_name"
                  name="bank_name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_cnaps_no">CNAPS No.</Label>
                <Input
                  defaultValue={initialData?.bank_cnaps_no ?? ""}
                  disabled={isPending}
                  id="bank_cnaps_no"
                  name="bank_cnaps_no"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bank_swift_code">SWIFT Code</Label>
                <Input
                  defaultValue={initialData?.bank_swift_code ?? ""}
                  disabled={isPending}
                  id="bank_swift_code"
                  name="bank_swift_code"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_address">Bank Address</Label>
              <Textarea
                defaultValue={initialData?.bank_address ?? ""}
                disabled={isPending}
                id="bank_address"
                name="bank_address"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={initialData?.notes ?? ""} disabled={isPending} id="notes" name="notes" />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "create" ? "Create Supplier" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
