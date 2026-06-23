"use client";

import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveSetComponents } from "@/app/actions/products";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Product, ProductComponent } from "@/types";

type EditableComponent = {
  rowKey: string;
  component_product_id: string;
  quantity_per_set: number;
  sort_order: number;
  notes: string;
  component: Product | null;
};

function PaymentCategory({ category }: { category: Product["payment_category"] }) {
  return <span className="text-sm text-slate-600">{category ?? "-"}</span>;
}

function rowsFromComponents(components: ProductComponent[]): EditableComponent[] {
  return components
    .map((component, index) => ({
      rowKey: component.id ?? component.component_product_id,
      component_product_id: component.component_product_id,
      quantity_per_set: component.quantity_per_set,
      sort_order: component.sort_order || index + 1,
      notes: component.notes ?? "",
      component: component.component ?? null,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((component, index) => ({ ...component, sort_order: index + 1 }));
}

export function SetComponentsEditor({
  availableProducts,
  initialComponents,
  setProductId,
}: {
  setProductId: string;
  initialComponents: ProductComponent[];
  availableProducts: Product[];
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<EditableComponent[]>(() => rowsFromComponents(initialComponents));
  const [isPending, startTransition] = useTransition();

  const availableToAdd = useMemo(() => {
    const usedIds = new Set(rows.map((row) => row.component_product_id));
    return availableProducts.filter((product) => !usedIds.has(product.id));
  }, [availableProducts, rows]);

  function resetRows() {
    setRows(rowsFromComponents(initialComponents));
  }

  function renumber(nextRows: EditableComponent[]) {
    return nextRows.map((row, index) => ({ ...row, sort_order: index + 1 }));
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

  function updateRow(index: number, patch: Partial<EditableComponent>) {
    setRows((currentRows) => currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function updateComponent(index: number, productId: string) {
    const product = availableProducts.find((availableProduct) => availableProduct.id === productId) ?? null;
    updateRow(index, {
      component: product,
      component_product_id: product?.id ?? "",
    });
  }

  function addComponentRow() {
    setRows((currentRows) =>
      renumber([
        ...currentRows,
        {
          rowKey: crypto.randomUUID(),
          component_product_id: "",
          quantity_per_set: 1,
          sort_order: currentRows.length + 1,
          notes: "",
          component: null,
        },
      ])
    );
  }

  function removeRow(index: number) {
    setRows((currentRows) => renumber(currentRows.filter((_, rowIndex) => rowIndex !== index)));
  }

  function handleSave() {
    const selectedIds = rows.map((row) => row.component_product_id).filter(Boolean);
    const uniqueIds = new Set(selectedIds);

    if (selectedIds.length !== rows.length) {
      toast.error("Select a Rock Hill code for every component row");
      return;
    }

    if (uniqueIds.size !== selectedIds.length) {
      toast.error("A component can only be added once");
      return;
    }

    startTransition(async () => {
      const result = await saveSetComponents(
        setProductId,
        rows.map((row, index) => ({
          component_product_id: row.component_product_id,
          quantity_per_set: row.quantity_per_set,
          sort_order: index + 1,
          notes: row.notes,
        }))
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Set components saved");
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isEditing ? null : (
          <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
            Edit Components
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {isEditing ? <TableHead className="w-10" /> : null}
            <TableHead className="w-14">#</TableHead>
            <TableHead>Rock Hill Code</TableHead>
            <TableHead>English Name</TableHead>
            <TableHead>Chinese Name</TableHead>
            <TableHead>Payment Category</TableHead>
            <TableHead className="w-28">Qty / Set</TableHead>
            <TableHead>Notes</TableHead>
            {isEditing ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, index) => (
              <TableRow key={row.rowKey}>
                {isEditing ? (
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-slate-400" />
                  </TableCell>
                ) : null}
                <TableCell>{index + 1}</TableCell>
                <TableCell className="font-semibold text-[#0d1b34]">
                  {isEditing ? (
                    <Select onValueChange={(value) => updateComponent(index, value)} value={row.component_product_id}>
                      <SelectTrigger className="min-w-40 bg-white">
                        <SelectValue placeholder="Select code" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProducts
                          .filter((product) => {
                            if (product.id === row.component_product_id) {
                              return true;
                            }

                            return !rows.some(
                              (existingRow, rowIndex) =>
                                rowIndex !== index && existingRow.component_product_id === product.id
                            );
                          })
                          .map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.code}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    row.component?.code ?? "-"
                  )}
                </TableCell>
                <TableCell>{row.component?.name_english ?? "-"}</TableCell>
                <TableCell>{row.component?.name_chinese ?? "-"}</TableCell>
                <TableCell>
                  <PaymentCategory category={row.component?.payment_category ?? null} />
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      className="w-24"
                      min={1}
                      onChange={(event) =>
                        updateRow(index, { quantity_per_set: Number(event.currentTarget.value) || 1 })
                      }
                      type="number"
                      value={row.quantity_per_set}
                    />
                  ) : (
                    row.quantity_per_set
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
                        aria-label="Remove component"
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
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={isEditing ? 9 : 7}>
                No components added yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {isEditing ? (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex justify-start">
            <Button disabled={!availableToAdd.length} onClick={addComponentRow} type="button" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Component Row
            </Button>
          </div>

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
              Save Components
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
