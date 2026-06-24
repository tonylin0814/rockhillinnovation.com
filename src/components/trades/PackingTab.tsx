"use client";

import { AlertTriangle, FileText, Layers, Loader2, Lock, Package, RefreshCw, Tag, Unlock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  confirmPackingPlan,
  deletePackingPlan,
  generateBatchCartonLabelsPdf,
  generatePackingListPdf,
  generatePackingPlan,
  generateStackingInstructionsPdf,
  moveCaseToPallet,
  unlockPackingPlan,
} from "@/app/actions/packing-plan";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildDownloadUrl } from "@/lib/download";
import type { ContainerType, TradePackingPlan } from "@/types";

const CONTAINER_OPTIONS: { label: string; value: ContainerType }[] = [
  { label: "20GP", value: "20ft" },
  { label: "40GP", value: "40ft" },
  { label: "40HQ", value: "40hq" },
];

export function PackingTab({
  canManage,
  initialPlan,
  tradeId,
}: {
  tradeId: string;
  initialPlan: TradePackingPlan | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dismissOptimization, setDismissOptimization] = useState(false);
  const [containerType, setContainerType] = useState<ContainerType>(initialPlan?.container_type ?? "40hq");
  const [palletL, setPalletL] = useState(String(initialPlan?.pallet_length_cm ?? 120));
  const [palletW, setPalletW] = useState(String(initialPlan?.pallet_width_cm ?? 100));
  const [palletH, setPalletH] = useState(String(initialPlan?.pallet_height_cm ?? 15));
  const [palletMaxW, setPalletMaxW] = useState(String(initialPlan?.pallet_max_weight_kg ?? 1000));
  const [clearance, setClearance] = useState(String(initialPlan?.forklift_clearance_cm ?? 30));
  const plan = initialPlan;

  function refreshOnSuccess(result: { error?: string }) {
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      refreshOnSuccess(
        await generatePackingPlan(tradeId, {
          containerType,
          forkliftClearanceCm: Number(clearance),
          palletHeightCm: Number(palletH),
          palletLengthCm: Number(palletL),
          palletMaxWeightKg: Number(palletMaxW),
          palletWidthCm: Number(palletW),
        })
      );
    });
  }

  function handleDownload(type: "packing-list" | "stacking" | "labels") {
    if (!plan) return;
    setError(null);
    startTransition(async () => {
      const result =
        type === "packing-list"
          ? await generatePackingListPdf(plan.id, tradeId)
          : type === "stacking"
            ? await generateStackingInstructionsPdf(plan.id, tradeId)
            : await generateBatchCartonLabelsPdf(plan.id, tradeId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.downloadUrl) {
        window.open(buildDownloadUrl(result.downloadUrl, `${type}.pdf`), "_blank");
      }
    });
  }

  if (!plan) {
    if (!canManage) return <p className="text-sm text-slate-500">No packing plan has been generated yet.</p>;

    return (
      <Card className="max-w-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Generate Packing Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-slate-500">
            Pulls quantities from Order Lines and assigns cartons to pallets automatically.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Container Type</Label>
              <Select onValueChange={(value) => setContainerType(value as ContainerType)} value={containerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTAINER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumberInput label="Pallet Length (cm)" onChange={setPalletL} value={palletL} />
            <NumberInput label="Pallet Width (cm)" onChange={setPalletW} value={palletW} />
            <NumberInput label="Pallet Height (cm)" onChange={setPalletH} value={palletH} />
            <NumberInput label="Max Pallet Weight (kg)" onChange={setPalletMaxW} value={palletMaxW} />
            <div className="col-span-2">
              <NumberInput label="Forklift Clearance (cm)" onChange={setClearance} value={clearance} />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button disabled={pending} onClick={handleGenerate} type="button">
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
            Generate Packing Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isDraft = plan.status === "draft";
  const totalCases = plan.pallets.reduce((sum, pallet) => sum + pallet.total_cases, 0);
  const totalWeight = plan.pallets.reduce((sum, pallet) => sum + Number(pallet.total_weight_kg ?? 0), 0);
  const biggestPallet = [...plan.pallets].sort((a, b) => b.total_cases - a.total_cases)[0];
  const estimatedCapacity = biggestPallet ? Math.max(plan.pallets.length * biggestPallet.total_cases, totalCases) : 0;
  const utilization = estimatedCapacity > 0 ? Math.round((totalCases / estimatedCapacity) * 100) : 0;
  const casesToFill = Math.max(0, estimatedCapacity - totalCases);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <Badge className={isDraft ? "" : "bg-emerald-600"} variant={isDraft ? "outline" : "default"}>
          {plan.status.toUpperCase()}
        </Badge>
        <span className="text-sm text-slate-600">
          {plan.pallets.length} pallets / {totalCases} cases / {totalWeight.toFixed(2)} kg / {plan.container_type.toUpperCase()}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {canManage && isDraft ? (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={pending} size="sm" variant="outline">
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate packing plan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes the current plan and manual case moves.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => startTransition(async () => refreshOnSuccess(await deletePackingPlan(tradeId)))}
                    >
                      Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                disabled={pending}
                onClick={() => startTransition(async () => refreshOnSuccess(await confirmPackingPlan(plan.id, tradeId)))}
                size="sm"
              >
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                Confirm Plan
              </Button>
            </>
          ) : null}
          {canManage && !isDraft ? (
            <Button
              disabled={pending}
              onClick={() => startTransition(async () => refreshOnSuccess(await unlockPackingPlan(plan.id, tradeId)))}
              size="sm"
              variant="outline"
            >
              <Unlock className="mr-1.5 h-3.5 w-3.5" />
              Unlock Plan
            </Button>
          ) : null}
          <Button disabled={pending} onClick={() => handleDownload("packing-list")} size="sm" variant="outline">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Packing List PDF
          </Button>
          <Button disabled={pending} onClick={() => handleDownload("stacking")} size="sm" variant="outline">
            <Layers className="mr-1.5 h-3.5 w-3.5" /> Stacking
          </Button>
          <Button disabled={pending} onClick={() => handleDownload("labels")} size="sm" variant="outline">
            <Tag className="mr-1.5 h-3.5 w-3.5" /> Labels
          </Button>
        </div>
      </div>

      {casesToFill > 0 && !dismissOptimization ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start justify-between gap-3 pt-4">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Container Utilization: {utilization}%</p>
                <p className="text-xs text-amber-700">
                  You could add approximately {casesToFill} more cartons based on the current pallet pattern.
                </p>
              </div>
            </div>
            <Button className="h-7 w-7 text-amber-700" onClick={() => setDismissOptimization(true)} size="icon" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {plan.pallets.map((pallet) => (
          <Card className="border-slate-200" key={pallet.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span>{pallet.pallet_label}</span>
                {pallet.is_mixed ? <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">Mixed</Badge> : null}
                <span className="ml-auto text-sm font-normal text-slate-500">
                  {pallet.total_cases} cases / {Number(pallet.total_weight_kg ?? 0).toFixed(2)} kg
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs text-slate-500">
                    <th className="px-4 py-2 text-left font-medium">Case</th>
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Weight kg</th>
                    {canManage && isDraft ? <th className="px-4 py-2 text-left font-medium">Move</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pallet.cases.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 font-mono text-xs">{item.case_label}</td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{item.product_code}</span>
                        <span className="ml-2 text-xs text-slate-500">{item.product_name}</span>
                      </td>
                      <td className="px-4 py-2 text-right">{item.qty_in_case}</td>
                      <td className="px-4 py-2 text-right">{Number(item.weight_kg).toFixed(3)}</td>
                      {canManage && isDraft ? (
                        <td className="px-4 py-2">
                          <Select
                            onValueChange={(targetPalletId) =>
                              startTransition(async () =>
                                refreshOnSuccess(await moveCaseToPallet(item.id, targetPalletId, tradeId))
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Move..." /></SelectTrigger>
                            <SelectContent>
                              {plan.pallets
                                .filter((target) => target.id !== pallet.id)
                                .map((target) => (
                                  <SelectItem key={target.id} value={target.id}>{target.pallet_label}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NumberInput({ label, onChange, value }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input min="0" onChange={(event) => onChange(event.target.value)} step="0.01" type="number" value={value} />
    </div>
  );
}
