"use client";

import { ArrowUpDown, Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createCostHistory,
  createQuoteHistory,
  deleteCostHistory,
  deleteQuoteHistory,
  updateCostHistory,
  updateQuoteHistory,
} from "@/app/actions/history";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ProductOption = {
  id: string;
  code: string;
  supplier_product_code: string | null;
  name_english: string;
  name_chinese: string | null;
};

type SupplierOption = {
  id: string;
  code: string;
  name: string;
};

type QuoteSessionOption = {
  id: string;
  session_number: number;
  quote_date: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  trade?: { id: string; trade_id: string } | null;
};

type CostHistoryRow = {
  id: string;
  product_id: string;
  supplier_id: string | null;
  supplier_product_code: string | null;
  quoted_date: string;
  unit_cost_rmb: number;
  moq: string | null;
  quality: string | null;
  carton_box_packaging: string | null;
  source: string;
  notes: string | null;
  product?: ProductOption | null;
  supplier?: SupplierOption | null;
};

type QuoteHistoryRow = {
  id: string;
  session_id: string;
  product_id: string | null;
  quantity: number;
  unit_price_usd: number;
  total_price_usd: number;
  item_description: string | null;
  notes: string | null;
  product?: ProductOption | null;
  session?: QuoteSessionOption | null;
};

type SortDirection = "asc" | "desc";
type CostSortKey = "date" | "product" | "supplier" | "moq" | "unit" | "quality" | "carton" | "source";
type QuoteSortKey = "date" | "trade" | "product" | "name" | "qty" | "quote";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatRmb(value: number | null | undefined) {
  return typeof value === "number" ? `¥${value.toFixed(4)}` : "-";
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
  columnKey,
  direction,
  onSort,
  className,
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await action();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`${label} deleted`);
      router.refresh();
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
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CostHistoryDialog({
  children,
  cost,
  products,
  suppliers,
}: {
  children: ReactNode;
  cost?: CostHistoryRow;
  products: ProductOption[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = cost ? await updateCostHistory(cost.id, formData) : await createCostHistory(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(cost ? "Cost history updated" : "Cost history added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{cost ? "Edit Cost History" : "Add Cost History"}</DialogTitle>
          <DialogDescription>Manual product cost row.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Product</Label>
            <Select defaultValue={cost?.product_id} disabled={isPending} name="product_id" required>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.code} - {product.name_english}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select defaultValue={cost?.supplier_id ?? "none"} disabled={isPending} name="supplier_id">
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier_product_code">Supplier Code</Label>
            <Input
              defaultValue={cost?.supplier_product_code ?? ""}
              disabled={isPending}
              id="supplier_product_code"
              name="supplier_product_code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quoted_date">Date</Label>
            <Input
              defaultValue={cost?.quoted_date ?? new Date().toISOString().slice(0, 10)}
              disabled={isPending}
              id="quoted_date"
              name="quoted_date"
              required
              type="date"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit_cost_rmb">Unit (RMB)</Label>
            <Input
              defaultValue={cost?.unit_cost_rmb ?? ""}
              disabled={isPending}
              id="unit_cost_rmb"
              min="0"
              name="unit_cost_rmb"
              required
              step="0.0001"
              type="number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moq">MOQ</Label>
            <Input defaultValue={cost?.moq ?? ""} disabled={isPending} id="moq" name="moq" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quality">Quality</Label>
            <Input defaultValue={cost?.quality ?? ""} disabled={isPending} id="quality" name="quality" />
          </div>
          <label className="flex items-center gap-2 pt-8 text-sm font-medium text-[#0d1b34]">
            <input
              defaultChecked={Boolean(cost?.carton_box_packaging)}
              disabled={isPending}
              name="carton_box_packaging"
              type="checkbox"
              value="true"
            />
            Carton
          </label>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="source">Source</Label>
            <Input defaultValue={cost?.source ?? "manual"} disabled={isPending} id="source" name="source" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={cost?.notes ?? ""} disabled={isPending} id="notes" name="notes" />
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

function QuoteHistoryDialog({
  children,
  products,
  quote,
  sessions,
}: {
  children: ReactNode;
  products: ProductOption[];
  quote?: QuoteHistoryRow;
  sessions: QuoteSessionOption[];
}) {
  const router = useRouter();
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
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{quote ? "Edit Quote History" : "Add Quote History"}</DialogTitle>
          <DialogDescription>Manual supplier quote line.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2 sm:col-span-2">
            <Label>Quote Session</Label>
            <Select defaultValue={quote?.session_id} disabled={isPending} name="session_id" required>
              <SelectTrigger>
                <SelectValue placeholder="Select quote session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.trade?.trade_id ?? "Trade"} - Round {session.session_number} - {session.quote_date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              defaultValue={quote?.item_description ?? quote?.product?.name_english ?? ""}
              disabled={isPending}
              id="item_description"
              name="item_description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Qty</Label>
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
            <Label htmlFor="unit_price_usd">Quote (USD)</Label>
            <Input
              defaultValue={quote?.unit_price_usd ?? ""}
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

export function HistoryTabs({
  costRows,
  products,
  quoteRows,
  sessions,
  suppliers,
}: {
  costRows: CostHistoryRow[];
  products: ProductOption[];
  quoteRows: QuoteHistoryRow[];
  sessions: QuoteSessionOption[];
  suppliers: SupplierOption[];
}) {
  const [costSearch, setCostSearch] = useState("");
  const [costSourceFilter, setCostSourceFilter] = useState("all");
  const [costSortKey, setCostSortKey] = useState<CostSortKey>("date");
  const [costSortDirection, setCostSortDirection] = useState<SortDirection>("desc");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteSortKey, setQuoteSortKey] = useState<QuoteSortKey>("date");
  const [quoteSortDirection, setQuoteSortDirection] = useState<SortDirection>("desc");

  function handleCostSort(key: CostSortKey) {
    if (costSortKey === key) {
      setCostSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setCostSortKey(key);
    setCostSortDirection(key === "date" || key === "unit" ? "desc" : "asc");
  }

  function handleQuoteSort(key: QuoteSortKey) {
    if (quoteSortKey === key) {
      setQuoteSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setQuoteSortKey(key);
    setQuoteSortDirection(["date", "qty", "quote"].includes(key) ? "desc" : "asc");
  }

  const costSources = useMemo(
    () => Array.from(new Set(costRows.map((row) => row.source).filter(Boolean))).sort(),
    [costRows]
  );

  const filteredCostRows = useMemo(() => {
    const normalizedSearch = costSearch.trim().toLowerCase();

    return [...costRows]
      .filter((row) => {
        const matchesSource = costSourceFilter === "all" || row.source === costSourceFilter;
        const haystack = [
          row.product?.code,
          row.product?.name_english,
          row.product?.name_chinese,
          row.supplier_product_code,
          row.supplier?.code,
          row.moq,
          row.quality,
          row.source,
          row.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchesSource && (!normalizedSearch || haystack.includes(normalizedSearch));
      })
      .sort((a, b) => {
        const values: Record<CostSortKey, [string | number | null | undefined, string | number | null | undefined]> = {
          carton: [a.carton_box_packaging ? "Yes" : "No", b.carton_box_packaging ? "Yes" : "No"],
          date: [a.quoted_date, b.quoted_date],
          moq: [a.moq, b.moq],
          product: [a.product?.code, b.product?.code],
          quality: [a.quality, b.quality],
          source: [a.source, b.source],
          supplier: [a.supplier_product_code ?? a.supplier?.code, b.supplier_product_code ?? b.supplier?.code],
          unit: [a.unit_cost_rmb, b.unit_cost_rmb],
        };
        const comparison = compareValues(values[costSortKey][0], values[costSortKey][1]);
        return costSortDirection === "asc" ? comparison : -comparison;
      });
  }, [costRows, costSearch, costSortDirection, costSortKey, costSourceFilter]);

  const sortedQuotes = useMemo(
    () =>
      [...quoteRows].sort((a, b) => {
        const dateA = a.session?.quote_date ?? "";
        const dateB = b.session?.quote_date ?? "";
        return dateB.localeCompare(dateA) || (a.session?.trade?.trade_id ?? "").localeCompare(b.session?.trade?.trade_id ?? "");
      }),
    [quoteRows]
  );

  const filteredQuoteRows = useMemo(() => {
    const normalizedSearch = quoteSearch.trim().toLowerCase();

    return [...sortedQuotes]
      .filter((row) => {
        const haystack = [
          row.session?.trade?.trade_id,
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
  }, [quoteSearch, quoteSortDirection, quoteSortKey, sortedQuotes]);

  return (
    <Tabs className="space-y-4" defaultValue="cost">
      <TabsList>
        <TabsTrigger value="cost">Cost History</TabsTrigger>
        <TabsTrigger value="quote">Quote History</TabsTrigger>
      </TabsList>

      <TabsContent value="cost">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-[#0d1b34]">Cost History</h2>
            <CostHistoryDialog products={products} suppliers={suppliers}>
              <Button className="bg-[#0d1b34] hover:bg-[#13294d]" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Cost
              </Button>
            </CostHistoryDialog>
          </div>
          <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(16rem,1fr)_14rem]">
            <Input
              onChange={(event) => setCostSearch(event.target.value)}
              placeholder="Search product, supplier code, MOQ, quality, source..."
              value={costSearch}
            />
            <Select onValueChange={setCostSourceFilter} value={costSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {costSources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader activeKey={costSortKey} columnKey="date" direction={costSortDirection} onSort={handleCostSort}>
                  Date
                </SortHeader>
                <SortHeader activeKey={costSortKey} columnKey="product" direction={costSortDirection} onSort={handleCostSort}>
                  Rock Hill Code
                </SortHeader>
                <SortHeader activeKey={costSortKey} columnKey="supplier" direction={costSortDirection} onSort={handleCostSort}>
                  Supplier Code
                </SortHeader>
                <SortHeader
                  activeKey={costSortKey}
                  className="w-[6ch]"
                  columnKey="moq"
                  direction={costSortDirection}
                  onSort={handleCostSort}
                >
                  MOQ
                </SortHeader>
                <SortHeader
                  activeKey={costSortKey}
                  className="text-right"
                  columnKey="unit"
                  direction={costSortDirection}
                  onSort={handleCostSort}
                >
                  Unit (RMB)
                </SortHeader>
                <SortHeader
                  activeKey={costSortKey}
                  className="min-w-[16rem]"
                  columnKey="quality"
                  direction={costSortDirection}
                  onSort={handleCostSort}
                >
                  Quality
                </SortHeader>
                <SortHeader activeKey={costSortKey} columnKey="carton" direction={costSortDirection} onSort={handleCostSort}>
                  Carton
                </SortHeader>
                <SortHeader activeKey={costSortKey} columnKey="source" direction={costSortDirection} onSort={handleCostSort}>
                  Source
                </SortHeader>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCostRows.length ? (
                filteredCostRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.quoted_date)}</TableCell>
                    <TableCell>{row.product?.code ?? "-"}</TableCell>
                    <TableCell>{row.supplier_product_code ?? row.supplier?.code ?? "-"}</TableCell>
                    <TableCell>{row.moq ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium">{formatRmb(row.unit_cost_rmb)}</TableCell>
                    <TableCell>{row.quality ?? "-"}</TableCell>
                    <TableCell>{row.carton_box_packaging ? "Yes" : "No"}</TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <CostHistoryDialog cost={row} products={products} suppliers={suppliers}>
                          <Button size="icon" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </CostHistoryDialog>
                        <DeleteButton action={() => deleteCostHistory(row.id, row.product_id)} label="cost history" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={9}>
                    No cost history matches these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="quote">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-[#0d1b34]">Quote History</h2>
            <QuoteHistoryDialog products={products} sessions={sessions}>
              <Button className="bg-[#0d1b34] hover:bg-[#13294d]" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Quote
              </Button>
            </QuoteHistoryDialog>
          </div>
          <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(16rem,1fr)]">
            <Input
              onChange={(event) => setQuoteSearch(event.target.value)}
              placeholder="Search date, trade, Rock Hill code, product name..."
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
                    <TableCell>{row.product?.code ?? "-"}</TableCell>
                    <TableCell>{row.item_description ?? row.product?.name_english ?? "-"}</TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right">{formatUsd(row.unit_price_usd)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <QuoteHistoryDialog products={products} quote={row} sessions={sessions}>
                          <Button size="icon" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </QuoteHistoryDialog>
                        <DeleteButton action={() => deleteQuoteHistory(row.id, row.session_id)} label="quote history" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={7}>
                    No quote history matches these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
