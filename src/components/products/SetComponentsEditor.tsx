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
  availableParts,
  initialComponents,
  setProductId,
}: {
  setProductId: string;
  initialComponents: ProductComponent[];
  availableParts: Product[];
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<EditableComponent[]>(() => rowsFromComponents(initialComponents));
  const [selectedPartId, setSelectedPartId] = useState("");
  const [isPending, startTransition] = useTransition();

  const availableToAdd = useMemo(() => {
    const usedIds = new Set(rows.map((row) => row.component_product_id));
    return availableParts.filter((part) => !usedIds.has(part.id));
  }, [availableParts, rows]);

  function resetRows() {
    setRows(rowsFromComponents(initialComponents));
    setSelectedPartId("");
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

  function addComponent() {
    const part = availableParts.find((availablePart) => availablePart.id === selectedPartId);

    if (!part) {
      return;
    }

    setRows((currentRows) =>
      renumber([
        ...currentRows,
        {
          component_product_id: part.id,
          quantity_per_set: 1,
          sort_order: currentRows.length + 1,
          notes: "",
          component: part,
        },
      ])
    );
    setSelectedPartId("");
  }

  function removeRow(index: number) {
    setRows((currentRows) => renumber(currentRows.filter((_, rowIndex) => rowIndex !== index)));
  }

  function handleSave() {
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
            <TableHead>Code</TableHead>
            <TableHead>English Name</TableHead>
            <TableHead>Chinese Name</TableHead>
            <TableHead>Payment Category</TableHead>
            <TableHead>Qty / Set</TableHead>
            <TableHead>Notes</TableHead>
            {isEditing ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, index) => (
              <TableRow key={row.component_product_id}>
                {isEditing ? (
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-slate-400" />
                  </TableCell>
                ) : null}
                <TableCell>{index + 1}</TableCell>
                <TableCell className="font-semibold text-[#0d1b34]">{row.component?.code ?? "-"}</TableCell>
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select onValueChange={setSelectedPartId} value={selectedPartId}>
              <SelectTrigger className="bg-white sm:max-w-md">
                <SelectValue placeholder="Select a part to add" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.length ? (
                  availableToAdd.map((part) => (
                    <SelectItem key={part.id} value={part.id}>
                      {part.code} - {part.name_english}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem disabled value="none">
                    No active parts available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button disabled={!selectedPartId} onClick={addComponent} type="button" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Component
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
