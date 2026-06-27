"use client";

import { ArrowUpDown, Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createQuoteHistory, deleteQuoteHistory, updateQuoteHistory } from "@/app/actions/history";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { QuotationHistory } from "@/types";

type SortDirection = "asc" | "desc";
type QuoteSortKey = "date" | "trade" | "code" | "name" | "qty" | "quote" | "created";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatQuantity(value: number | null | undefined) {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }).format(value)
    : "-";
}

function formatUsd(value: number | null | undefined) {
  return typeof value === "number"
    ? `$${new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(value)}`
    : "-";
}

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined) {
  const normalizedA = a ?? "";
  const normalizedB = b ?? "";

  if (typeof normalizedA === "number" && typeof normalizedB === "number") {
    return normalizedA - normalizedB;
  }

  return String(normalizedA).localeCompare(String(normalizedB), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function SortHeader<T extends string>({
  activeKey,
  children,
  className,
  columnKey,
  direction,
  onSort,
}: {
  activeKey: T;
  children: ReactNode;
  className?: string;
  columnKey: T;
  direction: SortDirection;
  onSort: (key: T) => void;
}) {
  const isActive = activeKey === columnKey;

  return (
    <TableHead className={className}>
      <Button
        className="h-auto px-0 py-0 text-xs font-semibold text-slate-600 hover:bg-transparent hover:text-[#0d1b34]"
        onClick={() => onSort(columnKey)}
        type="button"
        variant="ghost"
      >
        {children}
        <ArrowUpDown className={`ml-1 h-3 w-3 ${isActive ? "text-[#0d1b34]" : "text-slate-400"}`} />
        {isActive ? <span className="ml-1 text-[10px] uppercase">{direction}</span> : null}
      </Button>
    </TableHead>
  );
}

function DeleteButton({
  action,
  label,
}: {
  action: () => Promise<{ success?: true; error?: string }>;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await action();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`${label} deleted`);
      window.location.reload();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} size="icon" type="button" variant="ghost">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this {label} row. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleDelete}>
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function QuoteHistoryDialog({ children, quote }: { children: ReactNode; quote?: QuotationHistory }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = quote ? await updateQuoteHistory(quote.id, formData) : await createQuoteHistory(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(quote ? "Quote history updated" : "Quote history added");
      setOpen(false);
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{quote ? "Edit Quote History" : "Add Quote History"}</DialogTitle>
          <DialogDescription>Permanent quoted-price reference row.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="quote_date">Date</Label>
            <Input
              defaultValue={quote?.quote_date ?? new Date().toISOString().slice(0, 10)}
              disabled={isPending}
              id="quote_date"
              name="quote_date"
              required
              type="date"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trade_id">Trade ID</Label>
            <Input defaultValue={quote?.trade_id ?? ""} disabled={isPending} id="trade_id" name="trade_id" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rock_hill_code">Rock Hill Code</Label>
            <Input
              defaultValue={quote?.rock_hill_code ?? ""}
              disabled={isPending}
              id="rock_hill_code"
              name="rock_hill_code"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product_name">Product Name</Label>
            <Input
              defaultValue={quote?.product_name ?? ""}
              disabled={isPending}
              id="product_name"
              name="product_name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              defaultValue={quote?.quantity ?? 1}
              disabled={isPending}
              id="quantity"
              min="0.0001"
              name="quantity"
              required
              step="0.0001"
              type="number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quoted_usd">Quoted USD</Label>
            <Input
              defaultValue={quote?.quoted_usd ?? ""}
              disabled={isPending}
              id="quoted_usd"
              min="0"
              name="quoted_usd"
              required
              step="0.0001"
              type="number"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={quote?.notes ?? ""} disabled={isPending} id="notes" name="notes" />
          </div>
          {error ? <p className="text-sm font-medium text-red-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuoteHistoryTable({
  canManage = true,
  quoteRows,
}: {
  canManage?: boolean;
  quoteRows: QuotationHistory[];
}) {
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteSortKey, setQuoteSortKey] = useState<QuoteSortKey>("date");
  const [quoteSortDirection, setQuoteSortDirection] = useState<SortDirection>("desc");

  function handleQuoteSort(key: QuoteSortKey) {
    if (quoteSortKey === key) {
      setQuoteSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setQuoteSortKey(key);
    setQuoteSortDirection(["date", "qty", "quote", "created"].includes(key) ? "desc" : "asc");
  }

  const filteredQuoteRows = useMemo(() => {
    const normalizedSearch = quoteSearch.trim().toLowerCase();

    return [...quoteRows]
      .filter((row) => {
        const haystack = [
          row.quote_date,
          row.trade_id,
          row.rock_hill_code,
          row.product_name,
          row.quantity,
          row.quoted_usd,
          row.notes,
          row.created_at,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return !normalizedSearch || haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const values: Record<QuoteSortKey, [string | number | null | undefined, string | number | null | undefined]> = {
          code: [a.rock_hill_code, b.rock_hill_code],
          created: [a.created_at, b.created_at],
          date: [a.quote_date, b.quote_date],
          name: [a.product_name, b.product_name],
          qty: [a.quantity, b.quantity],
          quote: [a.quoted_usd, b.quoted_usd],
          trade: [a.trade_id, b.trade_id],
        };
        const comparison = compareValues(values[quoteSortKey][0], values[quoteSortKey][1]);
        return quoteSortDirection === "asc" ? comparison : -comparison;
      });
  }, [quoteRows, quoteSearch, quoteSortDirection, quoteSortKey]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-[#0d1b34]">Quote History</h2>
        {canManage ? (
          <QuoteHistoryDialog>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Quote
            </Button>
          </QuoteHistoryDialog>
        ) : null}
      </div>
      <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(16rem,1fr)]">
        <Input
          onChange={(event) => setQuoteSearch(event.target.value)}
          placeholder="Search date, trade, Rock Hill code, product name, notes..."
          value={quoteSearch}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader activeKey={quoteSortKey} columnKey="date" direction={quoteSortDirection} onSort={handleQuoteSort}>
              Date
            </SortHeader>
            <SortHeader activeKey={quoteSortKey} columnKey="trade" direction={quoteSortDirection} onSort={handleQuoteSort}>
              Trade ID
            </SortHeader>
            <SortHeader activeKey={quoteSortKey} columnKey="code" direction={quoteSortDirection} onSort={handleQuoteSort}>
              Rock Hill Code
            </SortHeader>
            <SortHeader activeKey={quoteSortKey} columnKey="name" direction={quoteSortDirection} onSort={handleQuoteSort}>
              Product Name
            </SortHeader>
            <SortHeader
              activeKey={quoteSortKey}
              className="text-right"
              columnKey="qty"
              direction={quoteSortDirection}
              onSort={handleQuoteSort}
            >
              Qty
            </SortHeader>
            <SortHeader
              activeKey={quoteSortKey}
              className="text-right"
              columnKey="quote"
              direction={quoteSortDirection}
              onSort={handleQuoteSort}
            >
              Quoted USD
            </SortHeader>
            <TableHead>Notes</TableHead>
            <SortHeader
              activeKey={quoteSortKey}
              columnKey="created"
              direction={quoteSortDirection}
              onSort={handleQuoteSort}
            >
              Created
            </SortHeader>
            {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredQuoteRows.length ? (
            filteredQuoteRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.quote_date)}</TableCell>
                <TableCell>{row.trade_id ?? "-"}</TableCell>
                <TableCell>{row.rock_hill_code}</TableCell>
                <TableCell>{row.product_name}</TableCell>
                <TableCell className="text-right">{formatQuantity(row.quantity)}</TableCell>
                <TableCell className="text-right">{formatUsd(row.quoted_usd)}</TableCell>
                <TableCell>{row.notes ?? "-"}</TableCell>
                <TableCell>{formatDate(row.created_at)}</TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <QuoteHistoryDialog quote={row}>
                        <Button size="icon" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </QuoteHistoryDialog>
                      <DeleteButton action={() => deleteQuoteHistory(row.id)} label="quote history" />
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={canManage ? 9 : 8}>
                No quote history matches these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
