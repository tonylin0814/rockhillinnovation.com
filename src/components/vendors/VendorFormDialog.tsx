"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createVendor, updateVendor } from "@/app/actions/vendors";
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
import type { ExpenseVendor } from "@/types";

type VendorFormDialogProps = {
  mode: "create" | "edit";
  initialData?: ExpenseVendor;
  trigger?: ReactNode;
};

export function VendorFormDialog({ mode, initialData, trigger }: VendorFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendorType, setVendorType] = useState<ExpenseVendor["vendor_type"]>(
    initialData?.vendor_type ?? "consulting"
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setError(null);
      setVendorType(initialData?.vendor_type ?? "consulting");
    }
  }, [initialData, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("vendor_type", vendorType);

    startTransition(async () => {
      const result =
        mode === "create" ? await createVendor(formData) : await updateVendor(initialData?.id ?? "", formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      toast.success(mode === "create" ? "Vendor created successfully" : "Vendor updated successfully");
      router.refresh();

      if (mode === "create" && result.id) {
        router.push(`/vendors/${result.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Vendor" : "Edit Vendor"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create a new expense vendor profile." : "Update this vendor profile."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Vendor Code</Label>
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
              <Label htmlFor="name">Full Name</Label>
              <Input defaultValue={initialData?.name ?? ""} disabled={isPending} id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input defaultValue={initialData?.country ?? ""} disabled={isPending} id="country" name="country" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor_type">Vendor Type</Label>
              <Select
                disabled={isPending}
                onValueChange={(value: ExpenseVendor["vendor_type"]) => setVendorType(value)}
                value={vendorType}
              >
                <SelectTrigger id="vendor_type">
                  <SelectValue placeholder="Select vendor type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="related_company">Related Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea defaultValue={initialData?.address ?? ""} disabled={isPending} id="address" name="address" />
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
              {mode === "create" ? "Create Vendor" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
