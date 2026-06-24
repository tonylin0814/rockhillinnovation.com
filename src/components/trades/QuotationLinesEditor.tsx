"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveQuotationLines } from "@/app/actions/client-quotations";
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

type ProductOption = {
  id: string;
  code: string;
  supplier_product_code: string | null;
  name_english: string;
  latest_cost_rmb?: number | null;
  previous_quote_usd?: number | null;
};

type EditableQuotationLine = {
  id?: string;
  product_id: string;
  item_description: string;
  quantity: number;
  unit_price_usd: number;
  notes: string;
};

function rowsFromLines(lines: ClientQuotationLine[]): EditableQuotationLine[] {
  return lines.map((line) => ({
    id: line.id,
    product_id: line.product_id ?? "none",
    item_description: line.item_description ?? "",
    quantity: line.quantity,
    unit_price_usd: line.unit_price_usd,
    notes: line.notes ?? "",
  }));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function productLabel(product: ProductOption) {
  return [product.code, product.supplier_product_code, product.name_english].filter(Boolean).join(" - ");
}

export function QuotationLinesEditor({
  availableProducts,
  canManage,
  initialLines,
  sessionId,
  sessionStatus,
}: {
  sessionId: string;
  initialLines: ClientQuotationLine[];
  availableProducts: ProductOption[];
  sessionStatus: ClientQuotationSession["status"];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<EditableQuotationLine[]>(() => rowsFromLines(initialLines));
  const [isPending, startTransition] = useTransition();
  const productById = useMemo(
    () => new Map(availableProducts.map((product) => [product.id, product])),
    [availableProducts]
  );
  const canEdit = canManage && sessionStatus === "draft";
  const runningTotal = rows.reduce((total, row) => total + row.quantity * row.unit_price_usd, 0);

  function updateRow(index: number, patch: Partial<EditableQuotationLine>) {
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
    setRows(nextRows);
  }

  function addLine() {
    setRows((currentRows) => [
      ...currentRows,
      {
        product_id: "none",
        item_description: "",
        quantity: 1,
        unit_price_usd: 0,
        notes: "",
      },
    ]);
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
      unit_price_usd: product?.previous_quote_usd ?? rows[index].unit_price_usd,
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
          quantity: row.quantity,
          unit_price_usd: row.unit_price_usd,
          notes: row.notes || null,
        }))
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Quotation lines saved");
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
            <TableHead>Description</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Unit Price (USD)</TableHead>
            <TableHead>Prv. Quote</TableHead>
            <TableHead>Total (USD)</TableHead>
            <TableHead>Notes</TableHead>
            {isEditing ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, index) => {
              const product = row.product_id === "none" ? null : productById.get(row.product_id);
              const total = row.quantity * row.unit_price_usd;

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
                              {productLabel(availableProduct)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : product ? (
                      productLabel(product)
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        onChange={(event) => updateRow(index, { item_description: event.currentTarget.value })}
                        value={row.item_description}
                      />
                    ) : (
                      row.item_description || "-"
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
                          updateRow(index, { unit_price_usd: Number(event.currentTarget.value) || 0 })
                        }
                        step="0.01"
                        type="number"
                        value={row.unit_price_usd}
                      />
                    ) : (
                      formatUsd(row.unit_price_usd)
                    )}
                  </TableCell>
                  <TableCell>{product?.previous_quote_usd ? formatUsd(product.previous_quote_usd) : "-"}</TableCell>
                  <TableCell>{formatUsd(total)}</TableCell>
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
              <TableCell className="text-slate-500" colSpan={isEditing ? 9 : 8}>
                No lines yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold" colSpan={5}>
              Total
            </TableCell>
            <TableCell />
            <TableCell className="font-semibold">{formatUsd(runningTotal)}</TableCell>
            <TableCell colSpan={isEditing ? 2 : 1} />
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
