"use client";

import { AlertTriangle, FileText, Layers, Loader2, Lock, Package, RefreshCw, Tag, Unlock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  confirmPackingPlan,
  generateBatchCartonLabelsPdf,
  generatePackingListPdf,
  generatePackingPlan,
  generateStackingInstructionsPdf,
  moveCaseToPallet,
  unlockPackingPlan,
} from "@/app/actions/packing-plan";
import { useLanguage } from "@/context/LanguageContext";
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
  const { language } = useLanguage();
  const text = language === "zh"
    ? {
        cancel: "取消",
        case: "箱號",
        cases: "箱",
        confirmPlan: "確認裝櫃計畫",
        containerType: "櫃型",
        forkliftClearance: "堆高機間隙（cm）",
        generate: "產生裝櫃計畫",
        generateTitle: "產生裝櫃計畫",
        labels: "標籤",
        maxPalletWeight: "棧板最大重量（kg）",
        mixed: "混合",
        move: "移動",
        movePlaceholder: "移動...",
        noPlan: "尚未產生裝櫃計畫。",
        noQuote: "尚無已確認的供應商報價。請先到供應商報價頁籤確認一輪報價，再產生裝櫃計畫。",
        optimization: "櫃位使用率",
        optimizationHelp: "依照目前棧板模式，約可再增加 {cases} 箱。",
        packingList: "裝箱單 PDF",
        palletHeight: "棧板高度（cm）",
        palletLength: "棧板長度（cm）",
        palletWidth: "棧板寬度（cm）",
        product: "產品",
        qty: "數量",
        regenerate: "重新產生",
        regenerateDescription: "這會刪除目前計畫與手動移動的箱位。",
        regenerateTitle: "重新產生裝櫃計畫？",
        stacking: "堆疊圖",
        unlockPlan: "解鎖計畫",
        weightKg: "重量 kg",
      }
    : {
        cancel: "Cancel",
        case: "Case",
        cases: "cases",
        confirmPlan: "Confirm Plan",
        containerType: "Container Type",
        forkliftClearance: "Forklift Clearance (cm)",
        generate: "Generate Packing Plan",
        generateTitle: "Generate Packing Plan",
        labels: "Labels",
        maxPalletWeight: "Max Pallet Weight (kg)",
        mixed: "Mixed",
        move: "Move",
        movePlaceholder: "Move...",
        noPlan: "No packing plan has been generated yet.",
        noQuote: "No confirmed supplier quote found. Go to the Quotes tab and confirm a quote session before generating a packing plan.",
        optimization: "Container Utilization",
        optimizationHelp: "You could add approximately {cases} more cartons based on the current pallet pattern.",
        packingList: "Packing List PDF",
        palletHeight: "Pallet Height (cm)",
        palletLength: "Pallet Length (cm)",
        palletWidth: "Pallet Width (cm)",
        product: "Product",
        qty: "Qty",
        regenerate: "Regenerate",
        regenerateDescription: "This deletes the current plan and manual case moves.",
        regenerateTitle: "Regenerate packing plan?",
        stacking: "Stacking",
        unlockPlan: "Unlock Plan",
        weightKg: "Weight kg",
      };
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

  function handleRegenerate() {
    if (!plan) return;
    setError(null);
    startTransition(async () => {
      refreshOnSuccess(
        await generatePackingPlan(tradeId, {
          containerType: plan.container_type,
          forkliftClearanceCm: Number(plan.forklift_clearance_cm),
          palletHeightCm: Number(plan.pallet_height_cm),
          palletLengthCm: Number(plan.pallet_length_cm),
          palletMaxWeightKg: Number(plan.pallet_max_weight_kg),
          palletWidthCm: Number(plan.pallet_width_cm),
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
    if (!canManage) return <p className="text-sm text-slate-500">{text.noPlan}</p>;

    return (
      <Card className="max-w-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{text.generateTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-slate-500">
            {text.noQuote}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>{text.containerType}</Label>
              <Select onValueChange={(value) => setContainerType(value as ContainerType)} value={containerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTAINER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumberInput label={text.palletLength} onChange={setPalletL} value={palletL} />
            <NumberInput label={text.palletWidth} onChange={setPalletW} value={palletW} />
            <NumberInput label={text.palletHeight} onChange={setPalletH} value={palletH} />
            <NumberInput label={text.maxPalletWeight} onChange={setPalletMaxW} value={palletMaxW} />
            <div className="col-span-2">
              <NumberInput label={text.forkliftClearance} onChange={setClearance} value={clearance} />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button disabled={pending} onClick={handleGenerate} type="button">
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
            {text.generate}
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
          {plan.pallets.length} pallets / {totalCases} {text.cases} / {totalWeight.toFixed(2)} kg / {plan.container_type.toUpperCase()}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {canManage && isDraft ? (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={pending} size="sm" variant="outline">
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    {text.regenerate}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{text.regenerateTitle}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {text.regenerateDescription}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{text.cancel}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={handleRegenerate}
                    >
                      {text.regenerate}
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
                {text.confirmPlan}
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
              {text.unlockPlan}
            </Button>
          ) : null}
          <Button disabled={pending} onClick={() => handleDownload("packing-list")} size="sm" variant="outline">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> {text.packingList}
          </Button>
          <Button disabled={pending} onClick={() => handleDownload("stacking")} size="sm" variant="outline">
            <Layers className="mr-1.5 h-3.5 w-3.5" /> {text.stacking}
          </Button>
          <Button disabled={pending} onClick={() => handleDownload("labels")} size="sm" variant="outline">
            <Tag className="mr-1.5 h-3.5 w-3.5" /> {text.labels}
          </Button>
        </div>
      </div>

      {casesToFill > 0 && !dismissOptimization ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start justify-between gap-3 pt-4">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{text.optimization}: {utilization}%</p>
                <p className="text-xs text-amber-700">
                  {text.optimizationHelp.replace("{cases}", String(casesToFill))}
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
                {pallet.is_mixed ? <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">{text.mixed}</Badge> : null}
                <span className="ml-auto text-sm font-normal text-slate-500">
                  {pallet.total_cases} cases / {Number(pallet.total_weight_kg ?? 0).toFixed(2)} kg
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs text-slate-500">
                    <th className="px-4 py-2 text-left font-medium">{text.case}</th>
                    <th className="px-4 py-2 text-left font-medium">{text.product}</th>
                    <th className="px-4 py-2 text-right font-medium">{text.qty}</th>
                    <th className="px-4 py-2 text-right font-medium">{text.weightKg}</th>
                    {canManage && isDraft ? <th className="px-4 py-2 text-left font-medium">{text.move}</th> : null}
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
                            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder={text.movePlaceholder} /></SelectTrigger>
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
