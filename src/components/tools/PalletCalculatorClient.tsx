"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { exportCalculatorToProduct, getJudyPalletExplanation, type JudyPalletResult } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildPalletSideViewSvg,
  buildPalletTopViewSvg,
  CONTAINER_PRESETS,
  type CartonInput,
  type PalletCalculation,
  type PalletInput,
} from "@/lib/pallet-calculator";
import type { PalletProfile, Product } from "@/types";

type ContainerType = keyof typeof CONTAINER_PRESETS;

const CONTAINER_HEIGHTS_CM: Record<ContainerType, number> = {
  std: 239,
  "40hq": 269.8,
};

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inputValue(value: number | null | undefined, fallback = "") {
  return typeof value === "number" ? String(value) : fallback;
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
  }).format(value);
}

export function PalletCalculatorClient({
  palletProfiles,
  products,
}: {
  products: Product[];
  palletProfiles: PalletProfile[];
}) {
  const defaultProfile = palletProfiles.find((profile) => profile.is_default) ?? palletProfiles[0] ?? null;
  const [selectedProfileId, setSelectedProfileId] = useState(defaultProfile?.id ?? "");
  const [selectedProductId, setSelectedProductId] = useState("manual");
  const [exportProductId, setExportProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [cartonLengthCm, setCartonLengthCm] = useState("");
  const [cartonWidthCm, setCartonWidthCm] = useState("");
  const [cartonHeightCm, setCartonHeightCm] = useState("");
  const [cartonWeightKg, setCartonWeightKg] = useState("");
  const [qtyPerCarton, setQtyPerCarton] = useState("");
  const [forkliftClearanceCm, setForkliftClearanceCm] = useState("19");
  const [containerType, setContainerType] = useState<ContainerType>("40hq");
  const [judyResult, setJudyResult] = useState<JudyPalletResult | null>(null);
  const [calculationCarton, setCalculationCarton] = useState<CartonInput | null>(null);
  const [isCalculating, startCalculation] = useTransition();
  const [isExporting, startExport] = useTransition();

  const selectedProfile = useMemo(
    () => palletProfiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [palletProfiles, selectedProfileId]
  );
  const carton: CartonInput = useMemo(
    () => ({
      heightCm: numberValue(cartonHeightCm),
      lengthCm: numberValue(cartonLengthCm),
      qtyPerCarton: numberValue(qtyPerCarton),
      weightKg: numberValue(cartonWeightKg),
      widthCm: numberValue(cartonWidthCm),
    }),
    [cartonHeightCm, cartonLengthCm, cartonWeightKg, cartonWidthCm, qtyPerCarton]
  );
  const forkliftClearance = numberValue(forkliftClearanceCm);
  const containerHeight = CONTAINER_HEIGHTS_CM[containerType];
  const palletInput: PalletInput | null = selectedProfile
    ? {
        lengthCm: Number(selectedProfile.length_cm),
        maxHeightCm: Math.max(0, containerHeight - Number(selectedProfile.height_cm) - forkliftClearance),
        maxWeightKg: Number(selectedProfile.max_weight_kg),
        widthCm: Number(selectedProfile.width_cm),
      }
    : null;
  const canCalculate =
    Boolean(selectedProfile) &&
    carton.lengthCm > 0 &&
    carton.widthCm > 0 &&
    carton.heightCm > 0 &&
    carton.weightKg > 0 &&
    carton.qtyPerCarton > 0 &&
    forkliftClearance >= 0;
  const standardPlan = judyResult?.standardPlan ?? null;
  const hqPlan = judyResult?.hqPlan ?? null;
  const activePlan = containerType === "40hq" ? hqPlan : standardPlan;
  const containerItems = activePlan
    ? activePlan.itemsPerPallet * CONTAINER_PRESETS[containerType].pallets
    : null;
  const drawingCalculation = judyResult && activePlan
    ? buildDrawingCalculation(judyResult, activePlan)
    : null;
  const topViewSvg = drawingCalculation && calculationCarton && palletInput
    ? buildPalletTopViewSvg(calculationCarton, palletInput, drawingCalculation)
    : "";
  const standardSideViewSvg = calculationCarton && selectedProfile && judyResult && standardPlan
    ? buildPalletSideViewSvg(
        calculationCarton,
        {
          lengthCm: Number(selectedProfile.length_cm),
          maxHeightCm: getAvailableStackHeight("std"),
          maxWeightKg: Number(selectedProfile.max_weight_kg),
          widthCm: Number(selectedProfile.width_cm),
        },
        buildDrawingCalculation(judyResult, standardPlan)
      )
    : "";
  const hqSideViewSvg = calculationCarton && selectedProfile && judyResult && hqPlan
    ? buildPalletSideViewSvg(
        calculationCarton,
        {
          lengthCm: Number(selectedProfile.length_cm),
          maxHeightCm: getAvailableStackHeight("40hq"),
          maxWeightKg: Number(selectedProfile.max_weight_kg),
          widthCm: Number(selectedProfile.width_cm),
        },
        buildDrawingCalculation(judyResult, hqPlan)
      )
    : "";

  function buildDrawingCalculation(result: JudyPalletResult, plan: JudyPalletResult["standardPlan"]): PalletCalculation {
    return {
      cartonsAlongLength: result.layerSetup.cartonsAlongLength,
      cartonsAlongWidth: result.layerSetup.cartonsAlongWidth,
      cartonsPerLayer: result.layerSetup.cartonsPerLayer,
      cartonsPerPallet: plan.cartonsPerPallet,
      footprintUsedPct: 0,
      itemsPerPallet: plan.itemsPerPallet,
      layers: plan.layerCount,
      orientation: result.layerSetup.orientation,
      palletGrossWeightKg: plan.palletGrossWeightKg,
      palletHeightCm: plan.stackHeightCm,
    };
  }

  function getAvailableStackHeight(type: ContainerType) {
    if (!selectedProfile) {
      return 0;
    }

    return Math.max(0, CONTAINER_HEIGHTS_CM[type] - Number(selectedProfile.height_cm) - forkliftClearance);
  }

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    setExportProductId(productId === "manual" ? "" : productId);

    if (productId === "manual") {
      setProductName("");
      return;
    }

    const product = products.find((row) => row.id === productId);
    if (!product) return;

    setProductName(product.name_english);
    setCartonLengthCm(inputValue(product.carton_length_cm));
    setCartonWidthCm(inputValue(product.carton_width_cm));
    setCartonHeightCm(inputValue(product.carton_height_cm));
    setCartonWeightKg(inputValue(product.carton_weight_kg));
    setQtyPerCarton(inputValue(product.qty_per_carton));
  }

  function handleCalculate() {
    if (!canCalculate || !selectedProfile) {
      toast.error("Select a pallet profile and enter carton details first");
      return;
    }

    setCalculationCarton(carton);
    setJudyResult(null);

    startCalculation(async () => {
      const aiResult = await getJudyPalletExplanation({
        carton,
        forkliftClearanceCm: forkliftClearance,
        pallet: {
          heightCm: Number(selectedProfile.height_cm),
          lengthCm: Number(selectedProfile.length_cm),
          maxWeightKg: Number(selectedProfile.max_weight_kg),
          name: selectedProfile.name,
          widthCm: Number(selectedProfile.width_cm),
        },
        productName: productName || "Manual product",
      });

      if (aiResult.error) {
        toast.error(aiResult.error);
        return;
      }

      setJudyResult(aiResult.result ?? null);
    });
  }

  function handleExportToProduct() {
    if (!exportProductId || !standardPlan || !hqPlan) return;

    startExport(async () => {
      const result = await exportCalculatorToProduct(exportProductId, {
        carton_height_cm: carton.heightCm,
        carton_length_cm: carton.lengthCm,
        carton_weight_kg: carton.weightKg,
        carton_width_cm: carton.widthCm,
        cartons_per_pallet_hq: hqPlan.cartonsPerPallet,
        cartons_per_pallet_std: standardPlan.cartonsPerPallet,
        qty_per_carton: carton.qtyPerCarton,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Product updated");
    });
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0d1b34]">Pallet Calculator</h1>
        <p className="mt-2 text-sm text-slate-500">Calculate carton loading, pallet weight, and container totals.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select onValueChange={selectProduct} value={selectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual entry</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name_english}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name</Label>
              <Input id="product_name" onChange={(event) => setProductName(event.target.value)} value={productName} />
            </div>

            <div className="space-y-2">
              <Label>Pallet Profile</Label>
              <Select onValueChange={setSelectedProfileId} value={selectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a pallet profile" />
                </SelectTrigger>
                <SelectContent>
                  {palletProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name} - {profile.length_cm}x{profile.width_cm}x{profile.height_cm}cm · {profile.max_weight_kg}kg
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forklift_clearance">Forklift Clearance (cm)</Label>
              <Input
                id="forklift_clearance"
                min="0"
                onChange={(event) => setForkliftClearanceCm(event.target.value)}
                placeholder="19"
                step="1"
                type="number"
                value={forkliftClearanceCm}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Carton L (cm)</Label>
                <Input min="0" onChange={(event) => setCartonLengthCm(event.target.value)} step="0.01" type="number" value={cartonLengthCm} />
              </div>
              <div className="space-y-2">
                <Label>Carton W (cm)</Label>
                <Input min="0" onChange={(event) => setCartonWidthCm(event.target.value)} step="0.01" type="number" value={cartonWidthCm} />
              </div>
              <div className="space-y-2">
                <Label>Carton H (cm)</Label>
                <Input min="0" onChange={(event) => setCartonHeightCm(event.target.value)} step="0.01" type="number" value={cartonHeightCm} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Carton Weight (kg)</Label>
                <Input min="0" onChange={(event) => setCartonWeightKg(event.target.value)} step="0.01" type="number" value={cartonWeightKg} />
              </div>
              <div className="space-y-2">
                <Label>Qty / Carton</Label>
                <Input min="0" onChange={(event) => setQtyPerCarton(event.target.value)} step="1" type="number" value={qtyPerCarton} />
              </div>
            </div>

            <Button
              className="w-full bg-[#0d1b34] hover:bg-[#13294d]"
              disabled={!canCalculate || isCalculating}
              onClick={handleCalculate}
              type="button"
            >
              {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Calculate & Ask Judy
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(CONTAINER_PRESETS) as ContainerType[]).map((key) => (
              <Button
                className={containerType === key ? "bg-[#0d1b34] hover:bg-[#13294d]" : ""}
                key={key}
                onClick={() => setContainerType(key)}
                type="button"
                variant={containerType === key ? "default" : "outline"}
              >
                {CONTAINER_PRESETS[key].label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ["Cartons / Layer", judyResult?.layerSetup.cartonsPerLayer],
              ["Cartons / Pallet", activePlan?.cartonsPerPallet],
              ["Items / Pallet", activePlan?.itemsPerPallet],
              ["Container Items", containerItems],
            ].map(([label, value]) => (
              <Card className="border-slate-200 shadow-sm" key={label}>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">
                    {typeof value === "number" ? value.toLocaleString() : "-"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {judyResult && standardPlan && hqPlan ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layer Setup</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">
                    {judyResult.layerSetup.cartonsAlongLength} x {judyResult.layerSetup.cartonsAlongWidth}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{judyResult.layerSetup.cartonsPerLayer} cartons / layer</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">20 / 40GP</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">{standardPlan.layerCount} layers</p>
                  <p className={standardPlan.fits ? "mt-1 text-sm text-green-600" : "mt-1 text-sm text-red-600"}>
                    Total height {formatNumber(standardPlan.totalHeightCm)} cm
                  </p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">40HQ</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">{hqPlan.layerCount} layers</p>
                  <p className={hqPlan.fits ? "mt-1 text-sm text-green-600" : "mt-1 text-sm text-red-600"}>
                    Total height {formatNumber(hqPlan.totalHeightCm)} cm
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Calculation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCalculating ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#0d1b34]">Judy is calculating...</p>
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                </div>
              ) : judyResult && standardPlan && hqPlan ? (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Layer Arrangement</p>
                    <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p>
                        <span className="font-medium">Orientation:</span> {judyResult.layerSetup.orientation}
                      </p>
                      <p>
                        <span className="font-medium">Layout:</span>{" "}
                        {judyResult.layerSetup.cartonsAlongLength} x {judyResult.layerSetup.cartonsAlongWidth} ={" "}
                        <span className="font-semibold text-[#0d1b34]">
                          {judyResult.layerSetup.cartonsPerLayer} cartons per layer
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={`space-y-1 rounded-md border p-3 text-sm ${standardPlan.fits ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{"20' / 40' Container"}</p>
                      <p><span className="font-medium">Layers:</span> {standardPlan.layerCount}</p>
                      <p><span className="font-medium">Cartons / Pallet:</span> {standardPlan.cartonsPerPallet}</p>
                      <p><span className="font-medium">Items / Pallet:</span> {standardPlan.itemsPerPallet.toLocaleString()}</p>
                      <p><span className="font-medium">Gross Weight:</span> {formatNumber(standardPlan.palletGrossWeightKg)} kg</p>
                      <div className="mt-1 border-t border-slate-200 pt-1">
                        <p><span className="font-medium">Pallet:</span> {formatNumber(Number(selectedProfile?.height_cm ?? 0))} cm</p>
                        <p>
                          <span className="font-medium">Stack:</span> {formatNumber(standardPlan.stackHeightCm)} cm
                          {" "}({standardPlan.layerCount} x {formatNumber(standardPlan.layerCount > 0 ? standardPlan.stackHeightCm / standardPlan.layerCount : 0)} cm)
                        </p>
                        <p><span className="font-medium">Forklift:</span> {formatNumber(forkliftClearance)} cm</p>
                        <p className={`mt-1 font-semibold ${standardPlan.fits ? "text-green-700" : "text-red-700"}`}>
                          Total: {formatNumber(standardPlan.totalHeightCm)} cm
                          {standardPlan.fits ? " - Fits" : " - Does not fit"} (239 cm)
                        </p>
                      </div>
                    </div>

                    <div className={`space-y-1 rounded-md border p-3 text-sm ${hqPlan.fits ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{"40'HQ Container"}</p>
                      <p><span className="font-medium">Layers:</span> {hqPlan.layerCount}</p>
                      <p><span className="font-medium">Cartons / Pallet:</span> {hqPlan.cartonsPerPallet}</p>
                      <p><span className="font-medium">Items / Pallet:</span> {hqPlan.itemsPerPallet.toLocaleString()}</p>
                      <p><span className="font-medium">Gross Weight:</span> {formatNumber(hqPlan.palletGrossWeightKg)} kg</p>
                      <div className="mt-1 border-t border-slate-200 pt-1">
                        <p><span className="font-medium">Pallet:</span> {formatNumber(Number(selectedProfile?.height_cm ?? 0))} cm</p>
                        <p>
                          <span className="font-medium">Stack:</span> {formatNumber(hqPlan.stackHeightCm)} cm
                          {" "}({hqPlan.layerCount} x {formatNumber(hqPlan.layerCount > 0 ? hqPlan.stackHeightCm / hqPlan.layerCount : 0)} cm)
                        </p>
                        <p><span className="font-medium">Forklift:</span> {formatNumber(forkliftClearance)} cm</p>
                        <p className={`mt-1 font-semibold ${hqPlan.fits ? "text-green-700" : "text-red-700"}`}>
                          Total: {formatNumber(hqPlan.totalHeightCm)} cm
                          {hqPlan.fits ? " - Fits" : " - Does not fit"} (269.8 cm)
                        </p>
                      </div>
                    </div>
                  </div>

                  {judyResult.explanation ? (
                    <p className="border-t border-slate-100 pt-3 text-xs italic text-slate-500">{judyResult.explanation}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Click Calculate & Ask Judy to see stacking instructions.</p>
              )}
            </CardContent>
          </Card>

          {judyResult ? (
            <>
              <div className="grid gap-6 xl:grid-cols-3">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Top View</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto" dangerouslySetInnerHTML={{ __html: topViewSvg }} />
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>20 / 40GP Side View</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto" dangerouslySetInnerHTML={{ __html: standardSideViewSvg }} />
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>40HQ Side View</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto" dangerouslySetInnerHTML={{ __html: hqSideViewSvg }} />
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Export to Product</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Save carton dimensions and qty/carton to a product in your catalog.
                  </p>
                  <Select onValueChange={setExportProductId} value={exportProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product to update" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name_english}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button disabled={!exportProductId || !standardPlan || !hqPlan || isExporting} onClick={handleExportToProduct} variant="outline">
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Export Carton Data to Product
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
