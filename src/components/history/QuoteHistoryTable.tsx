"use client";

import { ArrowUpDown, Edit, Loader2, Trash2 } from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteQuoteHistory, updateQuoteHistory } from "@/app/actions/history";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ProductOption = {
  id: string;
  code: string;
  supplier_product_code: string | null;
  name_english: string;
  name_chinese: string | null;
};

export type QuoteHistoryRow = {
  id: string;
  session_id: string;
  product_id: string | null;
  quantity: number;
  unit_price_usd: number;
  total_price_usd: number;
  item_description: string | null;
  notes: string | null;
  product?: ProductOption | null;
  session?: {
    id: string;
    session_number: number;
    quote_date: string;
    status: string;
    trade?: { id: string; trade_id: string } | null;
    client?: { id: string; code: string; name: string } | null;
  } | null;
};

type SortDirection = "asc" | "desc";
type QuoteSortKey = "date" | "trade" | "client" | "product" | "name" | "qty" | "quote";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatUsd(value: number | null | undefined) {
  return typeof value === "number" ? `$${value.toFixed(4)}` : "-";
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

function QuoteHistoryDialog({
  children,
  products,
  quote,
}: {
  children: ReactNode;
  products: ProductOption[];
  quote: QuoteHistoryRow;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateQuoteHistory(quote.id, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Quote history updated");
      setOpen(false);
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Quote History</DialogTitle>
          <DialogDescription>Accepted client quotation reference row.</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-slate-500">
          Trade: <span className="font-medium text-[#0d1b34]">{quote.session?.trade?.trade_id ?? "-"}</span>
          {" · "}Session #{quote.session?.session_number}
        </p>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Product</Label>
            <Select defaultValue={quote?.product_id ?? "none"} disabled={isPending} name="product_id">
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.code} - {product.name_english}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="item_description">Product Name</Label>
            <Input
              defaultValue={quote.item_description ?? quote.product?.name_english ?? ""}
              disabled={isPending}
              id="item_description"
              name="item_description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Qty</Label>
            <Input
              defaultValue={quote.quantity}
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
            <Label htmlFor="unit_price_usd">Quote (USD)</Label>
            <Input
              defaultValue={quote.unit_price_usd}
              disabled={isPending}
              id="unit_price_usd"
              min="0"
              name="unit_price_usd"
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

export function QuoteHistoryTable({ products, quoteRows }: { products: ProductOption[]; quoteRows: QuoteHistoryRow[] }) {
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteSortKey, setQuoteSortKey] = useState<QuoteSortKey>("date");
  const [quoteSortDirection, setQuoteSortDirection] = useState<SortDirection>("desc");

  function handleQuoteSort(key: QuoteSortKey) {
    if (quoteSortKey === key) {
      setQuoteSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setQuoteSortKey(key);
    setQuoteSortDirection(["date", "qty", "quote"].includes(key) ? "desc" : "asc");
  }

  const filteredQuoteRows = useMemo(() => {
    const normalizedSearch = quoteSearch.trim().toLowerCase();

    return [...quoteRows]
      .filter((row) => {
        const haystack = [
          row.session?.quote_date,
          row.session?.trade?.trade_id,
          row.session?.client?.code,
          row.session?.client?.name,
          row.product?.code,
          row.product?.name_english,
          row.product?.name_chinese,
          row.item_description,
          row.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return !normalizedSearch || haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const values: Record<QuoteSortKey, [string | number | null | undefined, string | number | null | undefined]> = {
          client: [a.session?.client?.code, b.session?.client?.code],
          date: [a.session?.quote_date, b.session?.quote_date],
          name: [a.item_description ?? a.product?.name_english, b.item_description ?? b.product?.name_english],
          product: [a.product?.code, b.product?.code],
          qty: [a.quantity, b.quantity],
          quote: [a.unit_price_usd, b.unit_price_usd],
          trade: [a.session?.trade?.trade_id, b.session?.trade?.trade_id],
        };
        const comparison = compareValues(values[quoteSortKey][0], values[quoteSortKey][1]);
        return quoteSortDirection === "asc" ? comparison : -comparison;
      });
  }, [quoteRows, quoteSearch, quoteSortDirection, quoteSortKey]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-[#0d1b34]">Quote History</h2>
      </div>
      <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(16rem,1fr)]">
        <Input
          onChange={(event) => setQuoteSearch(event.target.value)}
          placeholder="Search date, trade, client, Rock Hill code, product name..."
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
              Trade
            </SortHeader>
            <SortHeader activeKey={quoteSortKey} columnKey="client" direction={quoteSortDirection} onSort={handleQuoteSort}>
              Client
            </SortHeader>
            <SortHeader activeKey={quoteSortKey} columnKey="product" direction={quoteSortDirection} onSort={handleQuoteSort}>
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
              QTY
            </SortHeader>
            <SortHeader
              activeKey={quoteSortKey}
              className="text-right"
              columnKey="quote"
              direction={quoteSortDirection}
              onSort={handleQuoteSort}
            >
              Quote (USD)
            </SortHeader>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredQuoteRows.length ? (
            filteredQuoteRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.session?.quote_date ? formatDate(row.session.quote_date) : "-"}</TableCell>
                <TableCell>{row.session?.trade?.trade_id ?? "-"}</TableCell>
                <TableCell>{row.session?.client?.name ?? "-"}</TableCell>
                <TableCell>{row.product?.code ?? "-"}</TableCell>
                <TableCell>{row.item_description ?? row.product?.name_english ?? "-"}</TableCell>
                <TableCell className="text-right">{row.quantity}</TableCell>
                <TableCell className="text-right">{formatUsd(row.unit_price_usd)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <QuoteHistoryDialog products={products} quote={row}>
                      <Button size="icon" variant="ghost">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </QuoteHistoryDialog>
                    <DeleteButton action={() => deleteQuoteHistory(row.id)} label="quote history" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={8}>
                No quote history matches these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
