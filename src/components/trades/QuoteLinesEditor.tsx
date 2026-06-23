"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveQuoteLines } from "@/app/actions/supplier-quotes";
import { Badge } from "@/components/ui/badge";
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
  name_english: string;
};

type EditableQuoteLine = {
  id?: string;
  product_id: string;
  item_name_chinese: string;
  item_name_english: string;
  quantity: number;
  unit_price_rmb: number;
  payment_category: "outsourced" | "produced" | "misc_expense" | "none";
  notes: string;
  sort_order: number;
};

const categoryClasses: Record<Exclude<EditableQuoteLine["payment_category"], "none">, string> = {
  outsourced: "border-blue-200 bg-blue-50 text-blue-700",
  produced: "border-violet-200 bg-violet-50 text-violet-700",
  misc_expense: "border-amber-200 bg-amber-50 text-amber-700",
};

const categoryLabels: Record<EditableQuoteLine["payment_category"], string> = {
  outsourced: "Outsourced",
  produced: "Produced",
  misc_expense: "Misc Expense",
  none: "-",
};

function rowsFromLines(lines: SupplierQuoteLine[]): EditableQuoteLine[] {
  return lines
    .map((line, index) => ({
      id: line.id,
      product_id: line.product_id ?? "none",
      item_name_chinese: line.item_name_chinese ?? "",
      item_name_english: line.item_name_english ?? "",
      quantity: line.quantity,
      unit_price_rmb: line.unit_price_rmb,
      payment_category: (line.payment_category ?? "none") as EditableQuoteLine["payment_category"],
      notes: line.notes ?? "",
      sort_order: line.sort_order || index + 1,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((line, index) => ({ ...line, sort_order: index + 1 }));
}

function formatRmb(value: number) {
  return `\u00A5${value.toFixed(2)}`;
}

function PaymentCategoryBadge({ category }: { category: EditableQuoteLine["payment_category"] }) {
  if (category === "none") {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <Badge className={categoryClasses[category]} variant="outline">
      {categoryLabels[category]}
    </Badge>
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
  const [isPending, startTransition] = useTransition();
  const productById = useMemo(
    () => new Map(availableProducts.map((product) => [product.id, product])),
    [availableProducts]
  );
  const canEdit = canManage && sessionStatus === "draft";
  const runningTotal = rows.reduce((total, row) => total + row.quantity * row.unit_price_rmb, 0);

  function renumber(nextRows: EditableQuoteLine[]) {
    return nextRows.map((row, index) => ({ ...row, sort_order: index + 1 }));
  }

  function updateRow(index: number, patch: Partial<EditableQuoteLine>) {
    setRows((currentRows) => currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function moveRow(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= rows.length) {
      return;
    }

    const nextRows = [...rows];
    const current = nextRows[index];
    nextRows[index] = nextRows[targetIndex];
    nextRows[targetIndex] = current;
    setRows(renumber(nextRows));
  }

  function addLine() {
    setRows((currentRows) =>
      renumber([
        ...currentRows,
        {
          product_id: "none",
          item_name_chinese: "",
          item_name_english: "",
          quantity: 1,
          unit_price_rmb: 0,
          payment_category: "none",
          notes: "",
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
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveQuoteLines(
        sessionId,
        rows.map((row, index) => ({
          id: row.id,
          product_id: row.product_id === "none" ? null : row.product_id,
          item_name_chinese: row.item_name_chinese || null,
          item_name_english: row.item_name_english || null,
          quantity: row.quantity,
          unit_price_rmb: row.unit_price_rmb,
          payment_category: row.payment_category === "none" ? null : row.payment_category,
          notes: row.notes || null,
          sort_order: index + 1,
        }))
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Quote lines saved");
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
            <TableHead>Product</TableHead>
            <TableHead>Chinese Name</TableHead>
            <TableHead>English Name</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Unit Price (RMB)</TableHead>
            <TableHead>Total (RMB)</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Notes</TableHead>
            {isEditing ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, index) => {
              const product = row.product_id === "none" ? null : productById.get(row.product_id);
              const total = row.quantity * row.unit_price_rmb;

              return (
                <TableRow key={row.id ?? `new-${index}`}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select onValueChange={(value) => handleProductChange(index, value)} value={row.product_id}>
                        <SelectTrigger className="min-w-52">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {availableProducts.map((availableProduct) => (
                            <SelectItem key={availableProduct.id} value={availableProduct.id}>
                              {availableProduct.code} - {availableProduct.name_english}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : product ? (
                      `${product.code} - ${product.name_english}`
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        onChange={(event) => updateRow(index, { item_name_chinese: event.currentTarget.value })}
                        value={row.item_name_chinese}
                      />
                    ) : (
                      row.item_name_chinese || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        onChange={(event) => updateRow(index, { item_name_english: event.currentTarget.value })}
                        value={row.item_name_english}
                      />
                    ) : (
                      row.item_name_english || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        className="w-24"
                        min="0.001"
                        onChange={(event) => updateRow(index, { quantity: Number(event.currentTarget.value) || 1 })}
                        step="0.001"
                        type="number"
                        value={row.quantity}
                      />
                    ) : (
                      row.quantity
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        className="w-28"
                        min={0}
                        onChange={(event) =>
                          updateRow(index, { unit_price_rmb: Number(event.currentTarget.value) || 0 })
                        }
                        step="0.01"
                        type="number"
                        value={row.unit_price_rmb}
                      />
                    ) : (
                      formatRmb(row.unit_price_rmb)
                    )}
                  </TableCell>
                  <TableCell>{formatRmb(total)}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select
                        onValueChange={(value: EditableQuoteLine["payment_category"]) =>
                          updateRow(index, { payment_category: value })
                        }
                        value={row.payment_category}
                      >
                        <SelectTrigger className="min-w-40">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          <SelectItem value="outsourced">Outsourced</SelectItem>
                          <SelectItem value="produced">Produced</SelectItem>
                          <SelectItem value="misc_expense">Misc Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <PaymentCategoryBadge category={row.payment_category} />
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        onChange={(event) => updateRow(index, { notes: event.currentTarget.value })}
                        value={row.notes}
                      />
                    ) : (
                      row.notes || "-"
                    )}
                  </TableCell>
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
              <TableCell className="text-slate-500" colSpan={isEditing ? 10 : 9}>
                No lines yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold" colSpan={6}>
              Total
            </TableCell>
            <TableCell className="font-semibold">{formatRmb(runningTotal)}</TableCell>
            <TableCell colSpan={isEditing ? 3 : 2} />
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
