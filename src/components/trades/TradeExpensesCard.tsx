"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { addTradeExpense, deleteTradeExpense, updateTradeExpense } from "@/app/actions/trade-expenses";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { TradeExpense } from "@/types";

const CATEGORY_LABELS: Record<TradeExpense["category"], string> = {
  bank_fee: "Bank Fee",
  duty: "Duty / Tax",
  misc: "Misc",
  reimbursement: "Reimbursement",
  shipping: "Shipping",
};

const CATEGORY_CLASSES: Record<TradeExpense["category"], string> = {
  bank_fee: "border-blue-200 bg-blue-50 text-blue-700",
  duty: "border-orange-200 bg-orange-50 text-orange-700",
  misc: "border-slate-200 bg-slate-100 text-slate-700",
  reimbursement: "border-amber-200 bg-amber-50 text-amber-700",
  shipping: "border-violet-200 bg-violet-50 text-violet-700",
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function ExpenseDialog({
  children,
  expense,
  tradeId,
}: {
  children: React.ReactNode;
  tradeId: string;
  expense?: TradeExpense;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(expense);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result =
        isEdit && expense
          ? await updateTradeExpense(expense.id, tradeId, formData)
          : await addTradeExpense(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(isEdit ? "Expense updated" : "Expense added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Input
              defaultValue={expense?.description ?? ""}
              disabled={isPending}
              id="description"
              name="description"
              placeholder="e.g. Bank wire fee for deposit payment"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount_usd">
                Amount (USD) <span className="text-red-500">*</span>
              </Label>
              <Input
                defaultValue={expense?.amount_usd ?? ""}
                disabled={isPending}
                id="amount_usd"
                min="0.01"
                name="amount_usd"
                required
                step="0.01"
                type="number"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense_date">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                defaultValue={expense?.expense_date ?? new Date().toISOString().slice(0, 10)}
                disabled={isPending}
                id="expense_date"
                name="expense_date"
                required
                type="date"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select defaultValue={expense?.category ?? "misc"} name="category">
              <SelectTrigger disabled={isPending} id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as TradeExpense["category"][]).map((category) => (
                  <SelectItem key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={expense?.notes ?? ""} disabled={isPending} id="notes" name="notes" rows={2} />
          </div>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isEdit ? "Save changes" : "Add expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TradeExpensesCard({
  canManage,
  initialExpenses,
  tradeId,
}: {
  tradeId: string;
  canManage: boolean;
  initialExpenses: TradeExpense[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTradeExpense(id, tradeId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Expense deleted");
      router.refresh();
    });
  }

  const total = initialExpenses.reduce((sum, expense) => sum + Number(expense.amount_usd), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0d1b34]">Trade Expenses</h3>
        {canManage ? (
          <ExpenseDialog tradeId={tradeId}>
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Expense
            </Button>
          </ExpenseDialog>
        ) : null}
      </div>

      {initialExpenses.length ? (
        <div className="rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount (USD)</TableHead>
                {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <div className="font-medium text-[#0d1b34]">{expense.description}</div>
                    {expense.notes ? <div className="text-xs text-slate-500">{expense.notes}</div> : null}
                  </TableCell>
                  <TableCell>
                    <Badge className={CATEGORY_CLASSES[expense.category]} variant="outline">
                      {CATEGORY_LABELS[expense.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(expense.expense_date)}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">
                    {formatUsd(Number(expense.amount_usd))}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <ExpenseDialog expense={expense} tradeId={tradeId}>
                          <Button size="icon" type="button" variant="ghost">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </ExpenseDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button disabled={isPending} size="icon" type="button" variant="ghost">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => handleDelete(expense.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end border-t border-slate-200 px-4 py-3">
            <span className="text-sm font-semibold text-[#0d1b34]">Total: {formatUsd(total)}</span>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          No expenses recorded for this trade.
        </p>
      )}
    </div>
  );
}
