"use client";

import { GripVertical, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveQuoteLines } from "@/app/actions/supplier-quotes";
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
import type { SupplierQuoteLine, SupplierQuoteSession } from "@/types";

type ProductOption = {
  id: string;
  code: string;
  supplier_product_code: string | null;
  name_english: string;
  product_type: "part" | "set";
  latest_cost_rmb?: number | null;
  previous_cost_rmb?: number | null;
};

type EditableQuoteLine = {
  id?: string;
  rowKey: string;
  product_id: string;
  item_name_english: string;
  quantity: string;
  unit_price_rmb: string;
  previous_unit_cost_rmb: number | null;
  unit_quote_usd: string;
  sort_order: number;
};

function rowsFromLines(lines: SupplierQuoteLine[]): EditableQuoteLine[] {
  return lines
    .map((line, index) => ({
      id: line.id,
      rowKey: line.id ?? crypto.randomUUID(),
      product_id: line.product_id ?? "none",
      item_name_english: line.item_name_english ?? "",
      quantity: String(line.quantity),
      unit_price_rmb: String(line.unit_price_rmb),
      previous_unit_cost_rmb: line.previous_unit_cost_rmb ?? null,
      unit_quote_usd: String(line.unit_quote_usd ?? 0),
      sort_order: line.sort_order || index + 1,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((line, index) => ({ ...line, sort_order: index + 1 }));
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

function formatRmbUnit(value: number) {
  return formatRmb(value, 3);
}

function formatRmbTotal(value: number) {
  return formatRmb(value, 2);
}

function formatPercent(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "-";
}

function compareProductsByName(a: ProductOption, b: ProductOption) {
  return (
    a.name_english.localeCompare(b.name_english, undefined, { sensitivity: "base", numeric: true }) ||
    a.code.localeCompare(b.code, undefined, { sensitivity: "base", numeric: true })
  );
}

export function QuoteLinesEditor({
  availableProducts,
  canManage,
  initialLines,
  sessionId,
  sessionStatus,
}: {
  sessionId: string;
  tradeId: string;
  initialLines: SupplierQuoteLine[];
  availableProducts: ProductOption[];
  sessionStatus: SupplierQuoteSession["status"];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<EditableQuoteLine[]>(() => rowsFromLines(initialLines));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const sortedProducts = useMemo(() => [...availableProducts].sort(compareProductsByName), [availableProducts]);
  const productById = useMemo(
    () => new Map(sortedProducts.map((product) => [product.id, product])),
    [sortedProducts]
  );
  const draftKey = useMemo(() => `rockhill:supplier-quote-lines:${sessionId}`, [sessionId]);
  const canEdit = canManage && sessionStatus === "draft";
  const runningCostTotal = rows.reduce(
    (total, row) => {
      const product = row.product_id === "none" ? null : productById.get(row.product_id);

      if (product?.product_type === "set") {
        return total;
      }

      return total + (Number(row.quantity) || 0) * (Number(row.unit_price_rmb) || 0);
    },
    0
  );

  function renumber(nextRows: EditableQuoteLine[]) {
    return nextRows.map((row, index) => ({ ...row, rowKey: row.rowKey ?? row.id ?? crypto.randomUUID(), sort_order: index + 1 }));
  }

  function updateRow(index: number, patch: Partial<EditableQuoteLine>) {
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
      return renumber(nextRows);
    });
  }

  useEffect(() => {
    if (!canEdit) return;

    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (!rawDraft) return;

      const parsed = JSON.parse(rawDraft) as { rows?: EditableQuoteLine[] };
      if (Array.isArray(parsed.rows)) {
        setRows(renumber(parsed.rows));
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
    setRows((currentRows) =>
      renumber([
        ...currentRows,
        {
          rowKey: crypto.randomUUID(),
          product_id: "none",
          item_name_english: "",
          quantity: "1",
          unit_price_rmb: "0",
          previous_unit_cost_rmb: null,
          unit_quote_usd: "0",
          sort_order: currentRows.length + 1,
        },
      ])
    );
  }

  function removeRow(index: number) {
    setRows((currentRows) => renumber(currentRows.filter((_, rowIndex) => rowIndex !== index)));
  }

  function resetRows() {
    setRows(rowsFromLines(initialLines));
  }

  function handleProductChange(index: number, productId: string) {
    const product = productById.get(productId);

    updateRow(index, {
      product_id: productId,
      item_name_english: product ? product.name_english : rows[index].item_name_english,
      unit_price_rmb: String(product?.latest_cost_rmb ?? 0),
      previous_unit_cost_rmb: product?.previous_cost_rmb ?? null,
    });
  }

  function focusNextQuantityInput(index: number) {
    const nextInput = document.querySelector<HTMLInputElement>(`[data-supplier-quote-qty-input-index="${index + 1}"]`);
    nextInput?.focus();
    nextInput?.select();
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveQuoteLines(
        sessionId,
        rows.map((row, index) => ({
          id: row.id,
          product_id: row.product_id === "none" ? null : row.product_id,
          item_name_chinese: null,
          item_name_english: row.item_name_english || null,
          quantity: Number(row.quantity) || 0,
          unit_price_rmb: Number(row.unit_price_rmb) || 0,
          previous_unit_cost_rmb:
            row.product_id === "none" ? null : productById.get(row.product_id)?.previous_cost_rmb ?? row.previous_unit_cost_rmb,
          unit_quote_usd: Number(row.unit_quote_usd) || 0,
          payment_category: null,
          notes: null,
          sort_order: index + 1,
        }))
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Quote lines saved");
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
            <TableHead>Prv. Cost</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>Change %</TableHead>
            {isEditing ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, index) => {
              const product = row.product_id === "none" ? null : productById.get(row.product_id);
              const previousUnitCostRmb = product?.previous_cost_rmb ?? row.previous_unit_cost_rmb;
              const costChange =
                previousUnitCostRmb === null ? null : (Number(row.unit_price_rmb) || 0) - previousUnitCostRmb;
              const costChangePct =
                previousUnitCostRmb === null || previousUnitCostRmb === 0
                  ? null
                  : ((costChange ?? 0) / previousUnitCostRmb) * 100;

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
                          {sortedProducts.map((availableProduct) => (
                            <SelectItem key={availableProduct.id} value={availableProduct.id}>
                              {availableProduct.name_english}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : product ? (
                      row.item_name_english || product.name_english
                    ) : (
                      row.item_name_english || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        className="w-[101px]"
                        data-supplier-quote-qty-input-index={index}
                        min="0.001"
                        onChange={(event) => updateRow(index, { quantity: event.currentTarget.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            focusNextQuantityInput(index);
                          }
                        }}
                        step="0.001"
                        type="number"
                        value={row.quantity}
                      />
                    ) : (
                      formatQuantity(Number(row.quantity) || 0)
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        className="w-28"
                        min={0}
                        onChange={(event) =>
                          updateRow(index, { unit_price_rmb: event.currentTarget.value })
                        }
                        step="0.001"
                        type="number"
                        value={row.unit_price_rmb}
                      />
                    ) : (
                      formatRmbUnit(Number(row.unit_price_rmb) || 0)
                    )}
                  </TableCell>
                  <TableCell>{previousUnitCostRmb === null ? "-" : formatRmbUnit(previousUnitCostRmb)}</TableCell>
                  <TableCell>{costChange === null ? "-" : formatRmbUnit(costChange)}</TableCell>
                  <TableCell>{formatPercent(costChangePct)}</TableCell>
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
              <TableCell className="text-slate-500" colSpan={isEditing ? 9 : 8}>
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
            {isEditing ? <TableCell /> : null}
          </TableRow>
        </TableFooter>
      </Table>

      {isEditing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button onClick={addLine} type="button" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Line
          </Button>
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
