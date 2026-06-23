"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { saveSetCostSnapshot } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductComponent, ProductCostHistory } from "@/types";

type ComponentCostRow = {
  componentId: string;
  code: string;
  name: string;
  quantityPerSet: number;
  latestCost: ProductCostHistory | null;
  extendedCost: number | null;
};

function formatRmb(value: number | null | undefined) {
  return typeof value === "number" ? `RMB ${value.toFixed(4)}` : "-";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function rowsFromComponents(
  components: ProductComponent[],
  latestCostsByProductId: Record<string, ProductCostHistory | null>
): ComponentCostRow[] {
  return components.map((component) => {
    const product = component.component;
    const latestCost = latestCostsByProductId[component.component_product_id] ?? null;
    const unitCost = latestCost?.unit_cost_rmb;

    return {
      code: product?.code ?? "-",
      componentId: component.component_product_id,
      extendedCost: typeof unitCost === "number" ? component.quantity_per_set * unitCost : null,
      latestCost,
      name: product?.name_english ?? "-",
      quantityPerSet: component.quantity_per_set,
    };
  });
}

export function SetCostCalculator({
  initialComponents,
  latestCostsByProductId,
  setProductId,
}: {
  initialComponents: ProductComponent[];
  latestCostsByProductId: Record<string, ProductCostHistory | null>;
  setProductId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const rows = rowsFromComponents(initialComponents, latestCostsByProductId);
  const missingCosts = rows.filter((row) => !row.latestCost);
  const totalCost = rows.reduce((total, row) => total + (row.extendedCost ?? 0), 0);
  const canSave = rows.length > 0 && missingCosts.length === 0;

  function handleSave() {
    if (!canSave) {
      toast.error("Every component needs a latest cost before saving a set snapshot");
      return;
    }

    startTransition(async () => {
      const result = await saveSetCostSnapshot(
        setProductId,
        totalCost,
        rows.map((row) => ({
          code: row.code,
          component_product_id: row.componentId,
          cost_date: row.latestCost?.quoted_date ?? null,
          extended_cost_rmb: row.extendedCost ?? 0,
          name: row.name,
          quantity_per_set: row.quantityPerSet,
          source: row.latestCost?.source ?? null,
          unit_cost_rmb: row.latestCost?.unit_cost_rmb ?? 0,
        }))
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Set cost snapshot saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Calculated Set Cost</p>
          <p className="mt-1 text-3xl font-semibold text-[#0d1b34]">{formatRmb(totalCost)}</p>
        </div>
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={!canSave || isPending} onClick={handleSave}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Set Cost Snapshot
        </Button>
      </div>

      {missingCosts.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Add cost history for {missingCosts.map((row) => row.code).join(", ")} before saving a snapshot.
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Component</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Qty / Set</TableHead>
            <TableHead className="text-right">Latest Unit Cost</TableHead>
            <TableHead className="text-right">Extended Cost</TableHead>
            <TableHead>Cost Date</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow key={row.componentId}>
                <TableCell className="font-medium text-[#0d1b34]">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right">{row.quantityPerSet}</TableCell>
                <TableCell className="text-right">{formatRmb(row.latestCost?.unit_cost_rmb)}</TableCell>
                <TableCell className="text-right">{formatRmb(row.extendedCost)}</TableCell>
                <TableCell>{formatDate(row.latestCost?.quoted_date)}</TableCell>
                <TableCell>{row.latestCost?.source ?? "-"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={7}>
                Add components before calculating set cost.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
