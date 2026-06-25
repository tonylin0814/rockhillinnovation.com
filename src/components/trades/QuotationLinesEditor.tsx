"use client";

import { GripVertical, Loader2, Plus, X } from "lucide-react";
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
  product_type: "part" | "set";
  latest_cost_rmb?: number | null;
  previous_quote_date?: string | null;
  previous_quote_trade_id?: string | null;
  previous_quote_usd?: number | null;
};

type EditableQuotationLine = {
  id?: string;
  rowKey: string;
  product_id: string;
  item_description: string;
  quantity: string;
  unit_price_usd: string;
  notes: string;
};

function formatDecimalInput(value: number | string, digits = 2) {
  const numericValue = parseNumericInput(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(digits) : "";
}

function parseNumericInput(value: number | string) {
  const normalizedValue = String(value).replace(/,/g, "").trim();
  return normalizedValue ? Number(normalizedValue) : Number.NaN;
}

function formatQuantityInput(value: number | string) {
  const numericValue = parseNumericInput(value);
  return Number.isFinite(numericValue) ? formatQuantity(numericValue) : "";
}

function rowsFromLines(lines: ClientQuotationLine[]): EditableQuotationLine[] {
  return lines.map((line) => ({
    id: line.id,
    rowKey: line.id ?? crypto.randomUUID(),
    product_id: line.product_id ?? "none",
    item_description: line.item_description ?? "",
    quantity: formatQuantityInput(line.quantity),
    unit_price_usd: formatDecimalInput(line.unit_price_usd),
    notes: line.notes ?? "",
  }));
}

function formatUsd(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
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

function formatExchangeRate(value: number | null) {
  return typeof value === "number" && value > 0 ? `Rate: ${value.toFixed(4)}` : "Rate: -";
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
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
    const costUsd = hasExchangeRate ? (product?.latest_cost_rmb ?? 0) / workingExchangeRate : 0;
    return total + (parseNumericInput(row.quantity) || 0) * costUsd;
  }, 0);
  const runningQuoteTotal = rows.reduce(
    (total, row) => total + (parseNumericInput(row.quantity) || 0) * (parseNumericInput(row.unit_price_usd) || 0),
    0
  );
  const runningProfitTotal = hasExchangeRate
    ? rows.reduce((total, row) => {
        const product = row.product_id === "none" ? null : productById.get(row.product_id);
        const costUsd = (product?.latest_cost_rmb ?? 0) / workingExchangeRate;
        return total + (parseNumericInput(row.quantity) || 0) * ((parseNumericInput(row.unit_price_usd) || 0) - costUsd);
      }, 0)
    : 0;
  const runningMargin = runningQuoteTotal > 0 && hasExchangeRate ? runningProfitTotal / runningQuoteTotal : null;

  function updateRow(index: number, patch: Partial<EditableQuotationLine>) {
    setRows((currentRows) => currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function shouldIgnoreDrag(target: EventTarget | null) {
    return target instanceof HTMLElement
      ? Boolean(target.closest("input, button, textarea, select, [role='combobox'], [data-radix-popper-content-wrapper]"))
      : false;
  }

  function reorderRow(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) {
      return;
    }

    setRows((currentRows) => {
      const nextRows = [...currentRows];
      const [movedRow] = nextRows.splice(fromIndex, 1);
      nextRows.splice(toIndex, 0, movedRow);
      return nextRows;
    });
  }

  function normalizeRows(nextRows: EditableQuotationLine[]) {
    return nextRows.map((row) => ({ ...row, rowKey: row.rowKey ?? row.id ?? crypto.randomUUID() }));
  }

  useEffect(() => {
    if (!canEdit) return;

    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (!rawDraft) return;

      const parsed = JSON.parse(rawDraft) as { rows?: EditableQuotationLine[] };
      if (Array.isArray(parsed.rows)) {
        setRows(normalizeRows(parsed.rows));
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

  function addLine() {
    setRows((currentRows) => [
      ...currentRows,
      {
        rowKey: crypto.randomUUID(),
        product_id: "none",
        item_description: "",
        quantity: formatQuantityInput(1),
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
          rowKey: crypto.randomUUID(),
          item_description: line.item_description,
          notes: line.notes,
          product_id: line.product_id ?? "none",
          quantity: formatQuantityInput(line.quantity),
          unit_price_usd: formatDecimalInput(line.unit_price_usd),
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
      unit_price_usd: formatDecimalInput(product?.previous_quote_usd ?? rows[index].unit_price_usd),
    });
  }

  function formatQuoteInput(index: number) {
    updateRow(index, { unit_price_usd: formatDecimalInput(rows[index].unit_price_usd) });
  }

  function formatQuantityField(index: number) {
    updateRow(index, { quantity: formatQuantityInput(rows[index].quantity) });
  }

  function focusNextQuoteInput(index: number) {
    const nextInput = document.querySelector<HTMLInputElement>(`[data-quote-input-index="${index + 1}"]`);

    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveQuotationLines(
        sessionId,
        rows.map((row) => ({
          id: row.id,
          product_id: row.product_id === "none" ? null : row.product_id,
          item_description: row.item_description || null,
          quantity: parseNumericInput(row.quantity) || 0,
          unit_price_usd: parseNumericInput(row.unit_price_usd) || 0,
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
            <TableHead>
              <div className="space-y-0.5">
                <span>Cost (USD)</span>
                <span className="block text-[11px] font-medium normal-case text-slate-500">
                  {formatExchangeRate(workingExchangeRate)}
                </span>
              </div>
            </TableHead>
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
              const quantity = parseNumericInput(row.quantity) || 0;
              const unitPriceUsd = parseNumericInput(row.unit_price_usd) || 0;
              const profit = costUsd === null ? null : unitPriceUsd - costUsd;
              const quoteTotal = quantity * unitPriceUsd;
              const profitTotal = profit === null ? null : quantity * profit;
              const margin = unitPriceUsd > 0 && profit !== null ? profit / unitPriceUsd : null;

              return (
                <TableRow
                  className={isEditing ? "cursor-move" : undefined}
                  draggable={isEditing}
                  key={row.rowKey}
                  onDragEnd={() => setDragIndex(null)}
                  onDragOver={(event) => {
                    if (!isEditing || dragIndex === null) return;
                    event.preventDefault();
                  }}
                  onDragStart={(event) => {
                    if (shouldIgnoreDrag(event.target)) {
                      event.preventDefault();
                      return;
                    }

                    setDragIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();

                    if (dragIndex !== null) {
                      reorderRow(dragIndex, index);
                    }

                    setDragIndex(null);
                  }}
                >
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      {isEditing ? <GripVertical className="h-4 w-4 text-slate-400" /> : null}
                      {index + 1}
                    </span>
                  </TableCell>
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
                        inputMode="decimal"
                        onBlur={() => formatQuantityField(index)}
                        onChange={(event) => updateRow(index, { quantity: event.currentTarget.value })}
                        type="text"
                        value={row.quantity}
                      />
                    ) : (
                      formatQuantity(parseNumericInput(row.quantity) || 0)
                    )}
                  </TableCell>
                  <TableCell>{costUsd === null ? "-" : formatUsd(costUsd, 3)}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        className="w-28"
                        data-quote-input-index={index}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateRow(index, { unit_price_usd: event.currentTarget.value })
                        }
                        onBlur={() => formatQuoteInput(index)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            formatQuoteInput(index);
                            focusNextQuoteInput(index);
                          }
                        }}
                        type="text"
                        value={row.unit_price_usd}
                      />
                    ) : (
                      formatUsd(parseNumericInput(row.unit_price_usd) || 0)
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
            <TableCell className="font-semibold">{hasExchangeRate ? formatUsd(runningCostTotal, 3) : "-"}</TableCell>
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
