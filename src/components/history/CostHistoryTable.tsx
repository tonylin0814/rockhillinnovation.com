"use client";

import { ArrowUpDown, Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createCostHistory, deleteCostHistory, updateCostHistory } from "@/app/actions/history";
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

type SupplierOption = {
  id: string;
  code: string;
  name: string;
};

export type CostHistoryRow = {
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

type SortDirection = "asc" | "desc";
type CostSortKey = "date" | "product" | "productName" | "moq" | "unit" | "quality" | "carton" | "source";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatRmb(value: number | null | undefined) {
  return typeof value === "number" ? `\u00A5${value.toFixed(4)}` : "-";
}

function formatMoq(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const numericValue = Number(value.replace(/,/g, ""));

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
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
      window.location.reload();
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

export function CostHistoryTable({
  canManage = true,
  costRows,
  products,
  suppliers,
}: {
  canManage?: boolean;
  costRows: CostHistoryRow[];
  products: ProductOption[];
  suppliers: SupplierOption[];
}) {
  const [costSearch, setCostSearch] = useState("");
  const [costSourceFilter, setCostSourceFilter] = useState("all");
  const [costSortKey, setCostSortKey] = useState<CostSortKey>("date");
  const [costSortDirection, setCostSortDirection] = useState<SortDirection>("desc");

  function handleCostSort(key: CostSortKey) {
    if (costSortKey === key) {
      setCostSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setCostSortKey(key);
    setCostSortDirection(key === "date" || key === "unit" ? "desc" : "asc");
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
          productName: [a.product?.name_english, b.product?.name_english],
          quality: [a.quality, b.quality],
          source: [a.source, b.source],
          unit: [a.unit_cost_rmb, b.unit_cost_rmb],
        };
        const comparison = compareValues(values[costSortKey][0], values[costSortKey][1]);
        return costSortDirection === "asc" ? comparison : -comparison;
      });
  }, [costRows, costSearch, costSortDirection, costSortKey, costSourceFilter]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-[#0d1b34]">Cost History</h2>
        {canManage ? (
          <CostHistoryDialog products={products} suppliers={suppliers}>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Cost
            </Button>
          </CostHistoryDialog>
        ) : null}
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
            <SortHeader
              activeKey={costSortKey}
              columnKey="productName"
              direction={costSortDirection}
              onSort={handleCostSort}
            >
              Product Name
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
            {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCostRows.length ? (
            filteredCostRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.quoted_date)}</TableCell>
                <TableCell>{row.product?.code ?? "-"}</TableCell>
                <TableCell>{row.product?.name_english ?? "-"}</TableCell>
                <TableCell>{formatMoq(row.moq)}</TableCell>
                <TableCell className="text-right font-medium">{formatRmb(row.unit_cost_rmb)}</TableCell>
                <TableCell>{row.quality ?? "-"}</TableCell>
                <TableCell>{row.carton_box_packaging ? "Yes" : "No"}</TableCell>
                <TableCell>{row.source}</TableCell>
                {canManage ? (
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
                ) : null}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={canManage ? 9 : 8}>
                No cost history matches these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
