"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { importQuotationLinesFromConfirmedQuote, saveQuotationLines } from "@/app/actions/client-quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClientQuotationLine, ClientQuotationSession } from "@/types";
import { PriceHistoryDialog } from "./PriceHistoryDialog";

type ProductOption = {
  id: string;
  code: string;
  supplier_product_code: string | null;
  name_english: string;
  latest_cost_rmb?: number | null;
  previous_quote_date?: string | null;
  previous_quote_trade_id?: string | null;
  previous_quote_usd?: number | null;
};

type EditableQuotationLine = {
  id?: string;
  product_id: string;
  item_description: string;
  quantity: string;
  unit_price_usd: string;
  notes: string;
};

function rowsFromLines(lines: ClientQuotationLine[]): EditableQuotationLine[] {
  return lines.map((line) => ({
    id: line.id,
    product_id: line.product_id ?? "none",
    item_description: line.item_description ?? "",
    quantity: String(line.quantity),
    unit_price_usd: String(line.unit_price_usd),
    notes: line.notes ?? "",
  }));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatRmb(value: number, digits = 2) {
  return `\u00A5${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)}`;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatRmbUnit(value: number) {
  return formatRmb(value, 3);
}

function formatRmbTotal(value: number) {
  return formatRmb(value, 2);
}

function formatPercent(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "-";
}

function compareProductsByName(a: ProductOption, b: ProductOption) {
  return (
    a.name_english.localeCompare(b.name_english, undefined, { sensitivity: "base", numeric: true }) ||
    a.code.localeCompare(b.code, undefined, { sensitivity: "base", numeric: true })
  );
}

function PreviousQuoteCell({ product }: { product: ProductOption | null | undefined }) {
  if (product?.previous_quote_usd == null) {
    return "-";
  }

  return (
    <span className="group relative inline-flex cursor-help items-center font-medium text-[#0d1b34]">
      {formatUsd(product.previous_quote_usd)}
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-max max-w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#0d1b34] shadow-lg group-hover:block">
        <span className="block">Previous trade: {product.previous_quote_trade_id ?? "-"}</span>
        <span className="block">
          Quoted date: {product.previous_quote_date ? formatDate(product.previous_quote_date) : "-"}
        </span>
      </span>
    </span>
  );
}

export function QuotationLinesEditor({
  availableProducts,
  canManage,
  initialLines,
  sessionId,
  sessionStatus,
  workingExchangeRate,
}: {
  sessionId: string;
  initialLines: ClientQuotationLine[];
  availableProducts: ProductOption[];
  sessionStatus: ClientQuotationSession["status"];
  canManage: boolean;
  workingExchangeRate: number | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<EditableQuotationLine[]>(() => rowsFromLines(initialLines));
  const [isPending, startTransition] = useTransition();
  const sortedProducts = useMemo(() => [...availableProducts].sort(compareProductsByName), [availableProducts]);
  const productById = useMemo(
    () => new Map(sortedProducts.map((product) => [product.id, product])),
    [sortedProducts]
  );
  const draftKey = useMemo(() => `rockhill:client-quotation-lines:${sessionId}`, [sessionId]);
  const selectedProductIds = useMemo(
    () => new Set(rows.map((row) => row.product_id).filter((productId) => productId !== "none")),
    [rows]
  );
  const canEdit = canManage && sessionStatus === "draft";
  const hasExchangeRate = typeof workingExchangeRate === "number" && workingExchangeRate > 0;
  const runningCostTotal = rows.reduce((total, row) => {
    const product = row.product_id === "none" ? null : productById.get(row.product_id);
    return total + (Number(row.quantity) || 0) * (product?.latest_cost_rmb ?? 0);
  }, 0);
  const runningQuoteTotal = rows.reduce(
    (total, row) => total + (Number(row.quantity) || 0) * (Number(row.unit_price_usd) || 0),
    0
  );
  const runningProfitTotal = hasExchangeRate
    ? rows.reduce((total, row) => {
        const product = row.product_id === "none" ? null : productById.get(row.product_id);
        const costUsd = (product?.latest_cost_rmb ?? 0) / workingExchangeRate;
        return total + (Number(row.quantity) || 0) * ((Number(row.unit_price_usd) || 0) - costUsd);
      }, 0)
    : 0;
  const runningMargin = runningQuoteTotal > 0 && hasExchangeRate ? runningProfitTotal / runningQuoteTotal : null;

  function updateRow(index: number, patch: Partial<EditableQuotationLine>) {
    setRows((currentRows) => currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  useEffect(() => {
    if (!canEdit) return;

    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (!rawDraft) return;

      const parsed = JSON.parse(rawDraft) as { rows?: EditableQuotationLine[] };
      if (Array.isArray(parsed.rows)) {
        setRows(parsed.rows);
        setIsEditing(true);
      }
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [canEdit, draftKey]);

  useEffect(() => {
    if (!canEdit || !isEditing) return;
    window.localStorage.setItem(draftKey, JSON.stringify({ rows }));
  }, [canEdit, draftKey, isEditing, rows]);

  function moveRow(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= rows.length) {
      return;
    }

    const nextRows = [...rows];
    const current = nextRows[index];
    nextRows[index] = nextRows[targetIndex];
    nextRows[targetIndex] = current;
    setRows(nextRows);
  }

  function addLine() {
    setRows((currentRows) => [
      ...currentRows,
      {
        product_id: "none",
        item_description: "",
        quantity: "1",
        unit_price_usd: "0",
        notes: "",
      },
    ]);
  }

  function importFromQuotes() {
    startTransition(async () => {
      const result = await importQuotationLinesFromConfirmedQuote(sessionId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const importedLines = result.lines ?? [];

      setRows(
        importedLines.map((line) => ({
          item_description: line.item_description,
          notes: line.notes,
          product_id: line.product_id ?? "none",
          quantity: String(line.quantity),
          unit_price_usd: String(line.unit_price_usd),
        }))
      );
      setIsEditing(true);
      toast.success(`Imported ${importedLines.length} line${importedLines.length === 1 ? "" : "s"} from Quotes`);
    });
  }

  function removeRow(index: number) {
    setRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index));
  }

  function resetRows() {
    setRows(rowsFromLines(initialLines));
  }

  function handleProductChange(index: number, productId: string) {
    const product = productById.get(productId);

    updateRow(index, {
      product_id: productId,
      item_description: product ? product.name_english : rows[index].item_description,
      unit_price_usd: String(product?.previous_quote_usd ?? rows[index].unit_price_usd),
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveQuotationLines(
        sessionId,
        rows.map((row) => ({
          id: row.id,
          product_id: row.product_id === "none" ? null : row.product_id,
          item_description: row.item_description || null,
          quantity: Number(row.quantity) || 0,
          unit_price_usd: Number(row.unit_price_usd) || 0,
          notes: row.notes || null,
        }))
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Quotation lines saved");
      window.localStorage.removeItem(draftKey);
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEdit && !isEditing ? (
          <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
            Edit Lines
          </Button>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">#</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="w-[101px]">Qty</TableHead>
            <TableHead>Cost (RMB)</TableHead>
            <TableHead>Quote</TableHead>
            <TableHead>Prv. Quote</TableHead>
            <TableHead>Profit</TableHead>
            <TableHead>Quote Total</TableHead>
            <TableHead>Profit Total</TableHead>
            <TableHead>Margin</TableHead>
            {!isEditing ? <TableHead className="text-right">History</TableHead> : null}
            {isEditing ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, index) => {
              const product = row.product_id === "none" ? null : productById.get(row.product_id);
              const productOptionsForRow = sortedProducts.filter(
                (availableProduct) =>
                  availableProduct.id === row.product_id || !selectedProductIds.has(availableProduct.id)
              );
              const unitCostRmb = product?.latest_cost_rmb ?? 0;
              const costUsd = hasExchangeRate ? unitCostRmb / workingExchangeRate : null;
              const quantity = Number(row.quantity) || 0;
              const unitPriceUsd = Number(row.unit_price_usd) || 0;
              const profit = costUsd === null ? null : unitPriceUsd - costUsd;
              const quoteTotal = quantity * unitPriceUsd;
              const profitTotal = profit === null ? null : quantity * profit;
              const margin = unitPriceUsd > 0 && profit !== null ? profit / unitPriceUsd : null;

              return (
                <TableRow key={row.id ?? `new-${index}`}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-mono text-sm">{product?.code ?? "-"}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select onValueChange={(value) => handleProductChange(index, value)} value={row.product_id}>
                        <SelectTrigger className="min-w-64">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {productOptionsForRow.map((availableProduct) => (
                            <SelectItem key={availableProduct.id} value={availableProduct.id}>
                              {availableProduct.name_english}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : product ? (
                      row.item_description || product.name_english
                    ) : (
                      row.item_description || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        className="w-[101px]"
                        min="0.001"
                        onChange={(event) => updateRow(index, { quantity: event.currentTarget.value })}
                        step="0.001"
                        type="number"
                        value={row.quantity}
                      />
                    ) : (
                      formatQuantity(Number(row.quantity) || 0)
                    )}
                  </TableCell>
                  <TableCell>{formatRmbUnit(unitCostRmb)}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        className="w-28"
                        min={0}
                        onChange={(event) =>
                          updateRow(index, { unit_price_usd: event.currentTarget.value })
                        }
                        step="0.01"
                        type="number"
                        value={row.unit_price_usd}
                      />
                    ) : (
                      formatUsd(Number(row.unit_price_usd) || 0)
                    )}
                  </TableCell>
                  <TableCell>
                    <PreviousQuoteCell product={product} />
                  </TableCell>
                  <TableCell>{profit === null ? "-" : formatUsd(profit)}</TableCell>
                  <TableCell>{formatUsd(quoteTotal)}</TableCell>
                  <TableCell>{profitTotal === null ? "-" : formatUsd(profitTotal)}</TableCell>
                  <TableCell>{formatPercent(margin)}</TableCell>
                  {!isEditing ? (
                    <TableCell>
                      <div className="flex justify-end">
                        {product ? (
                          <PriceHistoryDialog
                            productCode={product.code}
                            productId={product.id}
                            productName={product.name_english}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                  {isEditing ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => moveRow(index, "up")}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label="Move down"
                          disabled={index === rows.length - 1}
                          onClick={() => moveRow(index, "down")}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label="Remove line"
                          onClick={() => removeRow(index)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={12}>
                No lines yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold" colSpan={4}>
              Total
            </TableCell>
            <TableCell className="font-semibold">{formatRmbTotal(runningCostTotal)}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="font-semibold">{formatUsd(runningQuoteTotal)}</TableCell>
            <TableCell className="font-semibold">{hasExchangeRate ? formatUsd(runningProfitTotal) : "-"}</TableCell>
            <TableCell className="font-semibold">{formatPercent(runningMargin)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>

      {isEditing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={addLine} type="button" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Line
            </Button>
            <Button disabled={isPending} onClick={importFromQuotes} type="button" variant="outline">
              Import from Quotes
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              disabled={isPending}
              onClick={() => {
                window.localStorage.removeItem(draftKey);
                resetRows();
                setIsEditing(false);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={handleSave} type="button">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
