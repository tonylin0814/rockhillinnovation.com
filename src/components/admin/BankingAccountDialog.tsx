"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { createBankingAccount, updateBankingAccount } from "@/app/actions/company-settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyBankingAccount } from "@/types";

const FIELD_GROUPS = [
  {
    heading: "Account identity",
    fields: [
      { name: "currency", label: "Currency", placeholder: "USD", required: true },
      { name: "label", label: "Display label", placeholder: "USD Wire (USA)" },
      {
        name: "account_name",
        label: "Beneficiary / Account name",
        placeholder: "Rock Hill Innovation Co., Ltd",
        required: true,
      },
      { name: "account_number", label: "Account number", placeholder: "" },
      { name: "iban", label: "IBAN", placeholder: "" },
    ],
  },
  {
    heading: "Bank details",
    fields: [
      { name: "bank_name", label: "Bank name", placeholder: "East West Bank", required: true },
      { name: "bank_branch", label: "Branch", placeholder: "" },
      { name: "bank_address", label: "Bank address", placeholder: "", multiline: true },
      { name: "swift_code", label: "SWIFT / BIC", placeholder: "EWBKUS66XXX" },
      { name: "routing_number", label: "Routing / ABA", placeholder: "" },
      { name: "intermediary_bank", label: "Intermediary bank", placeholder: "" },
    ],
  },
] as const;

export function BankingAccountDialog({
  account,
  children,
  onDone,
}: {
  children: ReactNode;
  account?: CompanyBankingAccount;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(account);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = isEdit && account
        ? await updateBankingAccount(account.id, formData)
        : await createBankingAccount(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(isEdit ? "Account updated" : "Account added");
      setOpen(false);
      router.refresh();
      onDone?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit banking account" : "Add banking account"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {FIELD_GROUPS.map((group) => (
            <div className="space-y-3" key={group.heading}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.heading}</p>
              {group.fields.map((field) => (
                <div className="space-y-1.5" key={field.name}>
                  <Label htmlFor={field.name}>
                    {field.label}
                    {"required" in field && field.required ? <span className="ml-1 text-red-500">*</span> : null}
                  </Label>
                  {"multiline" in field && field.multiline ? (
                    <Textarea
                      defaultValue={(account?.[field.name as keyof CompanyBankingAccount] as string) ?? ""}
                      disabled={isPending}
                      id={field.name}
                      name={field.name}
                      placeholder={field.placeholder}
                      rows={2}
                    />
                  ) : (
                    <Input
                      defaultValue={(account?.[field.name as keyof CompanyBankingAccount] as string) ?? ""}
                      disabled={isPending}
                      id={field.name}
                      name={field.name}
                      placeholder={field.placeholder}
                      required={"required" in field && field.required}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes / Instructions</Label>
            <Textarea
              defaultValue={account?.notes ?? ""}
              disabled={isPending}
              id="notes"
              name="notes"
              placeholder="e.g. Bank fees are sender's responsibility"
              rows={2}
            />
          </div>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Add account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
