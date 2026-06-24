"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteBankingAccount, toggleBankingAccountActive } from "@/app/actions/company-settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CompanyBankingAccount } from "@/types";
import { BankingAccountDialog } from "./BankingAccountDialog";

const DISPLAY_FIELDS: Array<{ key: keyof CompanyBankingAccount; label: string }> = [
  { key: "bank_name", label: "Bank" },
  { key: "account_name", label: "Beneficiary" },
  { key: "account_number", label: "Account No" },
  { key: "swift_code", label: "SWIFT/BIC" },
  { key: "routing_number", label: "Routing/ABA" },
  { key: "iban", label: "IBAN" },
];

function AccountCard({ account }: { account: CompanyBankingAccount }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      const result = await toggleBankingAccountActive(account.id, checked);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBankingAccount(account.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Account deleted");
      router.refresh();
    });
  }

  return (
    <div className={`rounded-lg border bg-white p-5 shadow-sm transition-opacity ${!account.is_active ? "opacity-50" : ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-[#0d1b34] text-white hover:bg-[#0d1b34]">{account.currency}</Badge>
          <span className="font-semibold text-[#0d1b34]">{account.label ?? `${account.currency} Account`}</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={account.is_active} disabled={isPending} onCheckedChange={handleToggle} />
          <span className="text-xs text-slate-500">{account.is_active ? "Active" : "Inactive"}</span>
          <BankingAccountDialog account={account} onDone={() => router.refresh()}>
            <Button disabled={isPending} size="icon" type="button" variant="ghost">
              <Pencil className="h-4 w-4" />
            </Button>
          </BankingAccountDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isPending} size="icon" type="button" variant="ghost">
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete banking account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the account from invoice banking options. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <dl className="grid gap-1 sm:grid-cols-2">
        {DISPLAY_FIELDS.filter((field) => account[field.key]).map((field) => (
          <div className="flex gap-2 text-sm" key={field.key}>
            <dt className="w-28 shrink-0 text-slate-500">{field.label}:</dt>
            <dd className="font-medium text-slate-800">{String(account[field.key])}</dd>
          </div>
        ))}
        {account.bank_address ? (
          <div className="flex gap-2 text-sm sm:col-span-2">
            <dt className="w-28 shrink-0 text-slate-500">Address:</dt>
            <dd className="whitespace-pre-line font-medium text-slate-800">{account.bank_address}</dd>
          </div>
        ) : null}
        {account.intermediary_bank ? (
          <div className="flex gap-2 text-sm sm:col-span-2">
            <dt className="w-28 shrink-0 text-slate-500">Intermediary:</dt>
            <dd className="font-medium text-slate-800">{account.intermediary_bank}</dd>
          </div>
        ) : null}
        {account.notes ? (
          <div className="flex gap-2 text-sm sm:col-span-2">
            <dt className="w-28 shrink-0 text-slate-500">Notes:</dt>
            <dd className="italic text-slate-600">{account.notes}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function BankingAccountsTable({ accounts }: { accounts: CompanyBankingAccount[] }) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
        <p className="text-sm text-slate-500">No banking accounts yet.</p>
        <p className="mt-1 text-xs text-slate-400">
          Add your wire details and they will appear on all client invoice PDFs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <AccountCard account={account} key={account.id} />
      ))}
    </div>
  );
}
