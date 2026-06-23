"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createClient, updateClient } from "@/app/actions/clients";
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
import type { Client } from "@/types";

type ClientFormDialogProps = {
  mode: "create" | "edit";
  initialData?: Client;
  trigger?: ReactNode;
};

export function ClientFormDialog({ mode, initialData, trigger }: ClientFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositPct, setDepositPct] = useState(initialData?.deposit_pct ?? 50);
  const [finalPct, setFinalPct] = useState(initialData?.final_pct ?? 50);
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [shippingAddress, setShippingAddress] = useState(initialData?.shipping_address ?? "");
  const [shippingSameAsAddress, setShippingSameAsAddress] = useState(
    Boolean(initialData?.address && initialData?.shipping_address === initialData.address)
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setError(null);
      setDepositPct(initialData?.deposit_pct ?? 50);
      setFinalPct(initialData?.final_pct ?? 50);
      setAddress(initialData?.address ?? "");
      setShippingAddress(initialData?.shipping_address ?? "");
      setShippingSameAsAddress(Boolean(initialData?.address && initialData?.shipping_address === initialData.address));
    }
  }, [initialData, open]);

  function handleDepositChange(value: string) {
    const deposit = Number(value);

    setDepositPct(deposit);

    if (!Number.isNaN(deposit)) {
      setFinalPct(Math.max(0, Math.min(100, 100 - deposit)));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("deposit_pct", String(depositPct));
    formData.set("final_pct", String(finalPct));
    formData.set("address", address);
    formData.set("shipping_address", shippingSameAsAddress ? address : shippingAddress);

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClient(formData)
          : await updateClient(initialData?.id ?? "", formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      toast.success(mode === "create" ? "Client created successfully" : "Client updated successfully");
      router.refresh();

      if (mode === "create" && result.id) {
        router.push(`/clients/${result.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Client" : "Edit Client"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create a new client profile." : "Update this client profile."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Client Code</Label>
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
              <Label htmlFor="name">Company Name</Label>
              <Input defaultValue={initialData?.name ?? ""} disabled={isPending} id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input defaultValue={initialData?.country ?? ""} disabled={isPending} id="country" name="country" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input defaultValue={initialData?.currency ?? "USD"} id="currency" name="currency" readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit_pct">Deposit %</Label>
              <Input
                disabled={isPending}
                id="deposit_pct"
                max={100}
                min={0}
                name="deposit_pct"
                onChange={(event) => handleDepositChange(event.currentTarget.value)}
                type="number"
                value={depositPct}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="final_pct">Final %</Label>
              <Input
                disabled={isPending}
                id="final_pct"
                max={100}
                min={0}
                name="final_pct"
                onChange={(event) => setFinalPct(Number(event.currentTarget.value))}
                type="number"
                value={finalPct}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              disabled={isPending}
              id="address"
              name="address"
              onChange={(event) => {
                setAddress(event.currentTarget.value);
                if (shippingSameAsAddress) {
                  setShippingAddress(event.currentTarget.value);
                }
              }}
              value={address}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label htmlFor="shipping_address">Shipping Address</Label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  checked={shippingSameAsAddress}
                  className="h-4 w-4 rounded border-slate-300 text-[#0d1b34]"
                  disabled={isPending}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setShippingSameAsAddress(checked);
                    if (checked) {
                      setShippingAddress(address);
                    }
                  }}
                  type="checkbox"
                />
                Same as address
              </label>
            </div>
            <Textarea
              disabled={isPending || shippingSameAsAddress}
              id="shipping_address"
              name="shipping_address"
              onChange={(event) => setShippingAddress(event.currentTarget.value)}
              value={shippingSameAsAddress ? address : shippingAddress}
            />
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
              {mode === "create" ? "Create Client" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
