"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveOrderLines } from "@/app/actions/order-lines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComponentDemand, OrderLine } from "@/types";

type AvailableProduct = {
  id: string;
  code: string;
  name_english: string;
  product_type: string;
};

type EditableLine = {
  id?: string;
  original_item_name: string;
  product_id: string;
  quantity: number;
  unit_price_usd: number;
  notes: string;
  sort_order: number;
};

function rowsFromLines(lines: OrderLine[]): EditableLine[] {
  return lines
    .map((line, index) => ({
      id: line.id,
      original_item_name: line.original_item_name ?? "",
      product_id: line.product_id ?? "none",
      quantity: line.quantity,
      unit_price_usd: line.unit_price_usd,
      notes: line.notes ?? "",
      sort_order: line.sort_order || index + 1,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((line, index) => ({ ...line, sort_order: index + 1 }));
}

function formatUsd(value: number | null) {
  return typeof value === "number" ? `$${value.toFixed(2)}` : "-";
}

function formatRmb(value: number | null) {
  return typeof value === "number" ? `¥${value.toFixed(2)}` : "-";
}

function PaymentCategoryBadge({ category }: { category: string | null }) {
  if (!category) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <Badge
      className={
        category === "outsourced"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-violet-200 bg-violet-50 text-violet-700"
      }
      variant="outline"
    >
      {category}
    </Badge>
  );
}

export function OrderLinesTab({
  availableProducts,
  canManage,
  initialDemand,
  initialLines,
  tradeId,
}: {
  tradeId: string;
  initialLines: OrderLine[];
  initialDemand: ComponentDemand[];
  availableProducts: AvailableProduct[];
  workingExchangeRate: number | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<EditableLine[]>(() => rowsFromLines(initialLines));
  const [isPending, startTransition] = useTransition();

  const productById = useMemo(
    () => new Map(availableProducts.map((product) => [product.id, product])),
    [availableProducts]
  );

  function renumber(nextRows: EditableLine[]) {
    return nextRows.map((row, index) => ({ ...row, sort_order: index + 1 }));
  }

  function updateRow(index: number, patch: Partial<EditableLine>) {
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
          original_item_name: "",
          product_id: "none",
          quantity: 1,
          unit_price_usd: 0,
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

  function handleSave() {
    startTransition(async () => {
      const result = await saveOrderLines(
        tradeId,
        rows.map((row, index) => ({
          id: row.id,
          original_item_name: row.original_item_name || null,
          product_id: row.product_id === "none" ? null : row.product_id,
          quantity: row.quantity,
          unit_price_usd: row.unit_price_usd,
          notes: row.notes || null,
          sort_order: index + 1,
        }))
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Order lines saved");
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Order Lines</CardTitle>
          {canManage && !isEditing ? (
            <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
              Edit Order Lines
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">#</TableHead>
                <TableHead>Original Item</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price (USD)</TableHead>
                <TableHead>Total (USD)</TableHead>
                <TableHead>Notes</TableHead>
                {isEditing ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row, index) => {
                  const selectedProduct = row.product_id === "none" ? null : productById.get(row.product_id);
                  const total = row.quantity * row.unit_price_usd;

                  return (
                    <TableRow key={row.id ?? `new-${index}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            onChange={(event) => updateRow(index, { original_item_name: event.currentTarget.value })}
                            value={row.original_item_name}
                          />
                        ) : (
                          row.original_item_name || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select
                            onValueChange={(value) => updateRow(index, { product_id: value })}
                            value={row.product_id}
                          >
                            <SelectTrigger className="min-w-52">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {availableProducts.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.code} - {product.name_english}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : selectedProduct ? (
                          `${selectedProduct.code} - ${selectedProduct.name_english}`
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            className="w-24"
                            min={1}
                            onChange={(event) => updateRow(index, { quantity: Number(event.currentTarget.value) || 1 })}
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
                              aria-label="Remove row"
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
                  <TableCell className="text-slate-500" colSpan={isEditing ? 8 : 7}>
                    No order lines yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
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
                <Button
                  className="bg-[#0d1b34] hover:bg-[#13294d]"
                  disabled={isPending}
                  onClick={handleSave}
                  type="button"
                >
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Component Demand</CardTitle>
          <p className="text-sm text-slate-500">Automatically calculated from order lines and product catalog.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>English Name</TableHead>
                <TableHead>Chinese Name</TableHead>
                <TableHead>Payment Category</TableHead>
                <TableHead>Required Qty</TableHead>
                <TableHead>Unit Cost (RMB)</TableHead>
                <TableHead>Total Cost (RMB)</TableHead>
                <TableHead>Est. USD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialDemand.length ? (
                initialDemand.map((demand) => (
                  <TableRow key={demand.id}>
                    <TableCell className="font-semibold text-[#0d1b34]">{demand.product?.code ?? "-"}</TableCell>
                    <TableCell>{demand.product?.name_english ?? "-"}</TableCell>
                    <TableCell>{demand.product?.name_chinese ?? "-"}</TableCell>
                    <TableCell>
                      <PaymentCategoryBadge category={demand.product?.payment_category ?? null} />
                    </TableCell>
                    <TableCell>{demand.required_quantity}</TableCell>
                    <TableCell>{formatRmb(demand.latest_unit_cost_rmb)}</TableCell>
                    <TableCell>{formatRmb(demand.estimated_cost_rmb)}</TableCell>
                    <TableCell>
                      {typeof demand.estimated_cost_usd === "number" ? `~${formatUsd(demand.estimated_cost_usd)}` : "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={8}>
                    No order lines yet. Add order lines above to see component demand.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
