"use client";

import { Loader2 } from "lucide-react";
import { type MouseEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { exportCalculatorToProduct, getJudyPalletExplanation, type JudyPalletResult } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildPalletTopViewSvg,
  CONTAINER_PRESETS,
  type CartonInput,
  type PalletCalculation,
  type PalletInput,
} from "@/lib/pallet-calculator";
import type { PalletProfile, Product } from "@/types";

type ContainerType = keyof typeof CONTAINER_PRESETS;
type PlacedCarton = { x: number; y: number; rotated: boolean };

const CONTAINER_HEIGHTS_CM: Record<ContainerType, number> = {
  std: 239,
  "40hq": 269.8,
};

function numberValue(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function inputValue(value: number | null | undefined, fallback = "") {
  return typeof value === "number" ? String(value) : fallback;
}

function normalizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatIntegerInput(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const normalized = normalizeIntegerInput(String(value));
  if (!normalized) {
    return "";
  }

  return Number(normalized).toLocaleString("en-US", { maximumFractionDigits: 0 });
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
  const [editMode, setEditMode] = useState(false);
  const [editOverride, setEditOverride] = useState<{
    cartonsPerLayer: number;
    stdLayerCount: number;
    hqLayerCount: number;
  } | null>(null);
  const [editCartons, setEditCartons] = useState<PlacedCarton[]>([]);
  const [placementRotated, setPlacementRotated] = useState(false);
  const [editStdLayers, setEditStdLayers] = useState(0);
  const [editHqLayers, setEditHqLayers] = useState(0);
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
  const liveEditOverride = editMode
    ? {
        cartonsPerLayer: editCartons.length,
        hqLayerCount: editHqLayers,
        stdLayerCount: editStdLayers,
      }
    : editOverride;
  const displayCartonsPerLayer = liveEditOverride?.cartonsPerLayer ?? judyResult?.layerSetup.cartonsPerLayer ?? null;
  const palletHeightCm = selectedProfile ? Number(selectedProfile.height_cm) : 0;
  const displayStdLayerCount = liveEditOverride?.stdLayerCount ?? standardPlan?.layerCount ?? 0;
  const displayHqLayerCount = liveEditOverride?.hqLayerCount ?? hqPlan?.layerCount ?? 0;
  const displayStd = liveEditOverride ? deriveContainerDisplay(displayStdLayerCount, CONTAINER_HEIGHTS_CM.std) : standardPlan;
  const displayHq = liveEditOverride ? deriveContainerDisplay(displayHqLayerCount, CONTAINER_HEIGHTS_CM["40hq"]) : hqPlan;
  const activePlan = containerType === "40hq" ? displayHq : displayStd;
  const containerItems = activePlan
    ? activePlan.itemsPerPallet * CONTAINER_PRESETS[containerType].pallets
    : null;
  const drawingCalculation = judyResult && activePlan
    ? buildDrawingCalculation(judyResult, activePlan)
    : null;
  const topViewSvg = drawingCalculation && calculationCarton && palletInput
    ? buildPalletTopViewSvg(calculationCarton, palletInput, drawingCalculation)
    : "";

  function buildDrawingCalculation(result: JudyPalletResult, plan: JudyPalletResult["standardPlan"]): PalletCalculation {
    return {
      cartonsAlongLength: result.layerSetup.cartonsAlongLength,
      cartonsAlongWidth: result.layerSetup.cartonsAlongWidth,
      cartonsPerLayer: displayCartonsPerLayer ?? result.layerSetup.cartonsPerLayer,
      cartonsPerPallet: plan.cartonsPerPallet,
      footprintUsedPct: 0,
      itemsPerPallet: plan.itemsPerPallet,
      layers: plan.layerCount,
      orientation: result.layerSetup.orientation,
      palletGrossWeightKg: plan.palletGrossWeightKg,
      palletHeightCm: plan.stackHeightCm,
    };
  }

  function deriveContainerDisplay(layerCount: number, containerMaxHeightCm: number): JudyPalletResult["standardPlan"] {
    const cartonsPerLayer = displayCartonsPerLayer ?? 0;
    const cartonsPerPallet = cartonsPerLayer * layerCount;
    const itemsPerPallet = cartonsPerPallet * (calculationCarton?.qtyPerCarton ?? 0);
    const palletGrossWeightKg = cartonsPerPallet * (calculationCarton?.weightKg ?? 0);
    const stackHeightCm = layerCount * (calculationCarton?.heightCm ?? 0);
    const totalHeightCm = palletHeightCm + stackHeightCm + forkliftClearance;

    return {
      cartonsPerPallet,
      fits: totalHeightCm <= containerMaxHeightCm,
      itemsPerPallet,
      layerCount,
      palletGrossWeightKg,
      stackHeightCm,
      totalHeightCm,
    };
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
    setQtyPerCarton(formatIntegerInput(inputValue(product.qty_per_carton)));
  }

  function enterEditMode() {
    if (!judyResult) return;

    const initialCartons: PlacedCarton[] = [];
    const cartonLength = calculationCarton?.lengthCm ?? 0;
    const cartonWidth = calculationCarton?.widthCm ?? 0;
    const { cartonsAlongLength, cartonsAlongWidth } = judyResult.layerSetup;

    for (let i = 0; i < cartonsAlongLength; i++) {
      for (let j = 0; j < cartonsAlongWidth; j++) {
        initialCartons.push({ rotated: false, x: i * cartonLength, y: j * cartonWidth });
      }
    }

    setEditCartons(initialCartons);
    setEditStdLayers(standardPlan?.layerCount ?? 0);
    setEditHqLayers(hqPlan?.layerCount ?? 0);
    setPlacementRotated(false);
    setEditMode(true);
  }

  function cancelEditMode() {
    setEditMode(false);
    setEditCartons([]);
  }

  function saveEditMode(stdLayers: number, hqLayers: number) {
    setEditOverride({
      cartonsPerLayer: editCartons.length,
      hqLayerCount: hqLayers,
      stdLayerCount: stdLayers,
    });
    setEditMode(false);
  }

  function handleCalculate() {
    if (!canCalculate || !selectedProfile) {
      toast.error("Select a pallet profile and enter carton details first");
      return;
    }

    setCalculationCarton(carton);
    setJudyResult(null);
    setEditOverride(null);
    setEditMode(false);
    setEditCartons([]);

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
    if (!exportProductId || !displayStd || !displayHq) return;

    startExport(async () => {
      const result = await exportCalculatorToProduct(exportProductId, {
        carton_height_cm: carton.heightCm,
        carton_length_cm: carton.lengthCm,
        carton_weight_kg: carton.weightKg,
        carton_width_cm: carton.widthCm,
        cartons_per_pallet_hq: displayHq.cartonsPerPallet,
        cartons_per_pallet_std: displayStd.cartonsPerPallet,
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
                      {profile.name} - {profile.length_cm}x{profile.width_cm}x{profile.height_cm}cm · {formatNumber(Number(profile.max_weight_kg), 0)}kg
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
                <Input inputMode="numeric" onChange={(event) => setQtyPerCarton(formatIntegerInput(event.target.value))} type="text" value={qtyPerCarton} />
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
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            {judyResult && !editMode ? (
              <Button onClick={enterEditMode} size="sm" type="button" variant="outline">
                Edit
              </Button>
            ) : null}
            {editMode ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">20/40GP layers</span>
                  <Input
                    className="w-16"
                    min={1}
                    onChange={(event) => setEditStdLayers(Number(event.target.value))}
                    type="number"
                    value={editStdLayers}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">40HQ layers</span>
                  <Input
                    className="w-16"
                    min={1}
                    onChange={(event) => setEditHqLayers(Number(event.target.value))}
                    type="number"
                    value={editHqLayers}
                  />
                </div>
                <Button className="bg-[#0d1b34] hover:bg-[#13294d]" onClick={() => saveEditMode(editStdLayers, editHqLayers)} size="sm" type="button">
                  Save
                </Button>
                <Button onClick={cancelEditMode} size="sm" type="button" variant="outline">
                  Cancel
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ["Cartons / Layer", displayCartonsPerLayer],
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

          {judyResult && displayStd && displayHq ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layer Setup</p>
                    {editMode ? <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">editing</span> : null}
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">
                    {judyResult.layerSetup.cartonsAlongLength} x {judyResult.layerSetup.cartonsAlongWidth}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{displayCartonsPerLayer} cartons / layer</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">20 / 40GP</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">{displayStdLayerCount} layers</p>
                  <p className={displayStd.fits ? "mt-1 text-sm text-green-600" : "mt-1 text-sm text-red-600"}>
                    Total height {formatNumber(displayStd.totalHeightCm)} cm
                  </p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">40HQ</p>
                  <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">{displayHqLayerCount} layers</p>
                  <p className={displayHq.fits ? "mt-1 text-sm text-green-600" : "mt-1 text-sm text-red-600"}>
                    Total height {formatNumber(displayHq.totalHeightCm)} cm
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
              ) : judyResult && displayStd && displayHq ? (
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
                          {displayCartonsPerLayer} cartons per layer
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={`space-y-1 rounded-md border p-3 text-sm ${displayStd.fits ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{"20' / 40' Container"}</p>
                      <p><span className="font-medium">Layers:</span> {displayStd.layerCount}</p>
                      <p><span className="font-medium">Cartons / Pallet:</span> {displayStd.cartonsPerPallet}</p>
                      <p><span className="font-medium">Items / Pallet:</span> {displayStd.itemsPerPallet.toLocaleString()}</p>
                      <p><span className="font-medium">Gross Weight:</span> {formatNumber(displayStd.palletGrossWeightKg)} kg</p>
                      <div className="mt-1 border-t border-slate-200 pt-1">
                        <p><span className="font-medium">Pallet:</span> {formatNumber(Number(selectedProfile?.height_cm ?? 0))} cm</p>
                        <p>
                          <span className="font-medium">Stack:</span> {formatNumber(displayStd.stackHeightCm)} cm
                          {" "}({displayStd.layerCount} x {formatNumber(displayStd.layerCount > 0 ? displayStd.stackHeightCm / displayStd.layerCount : 0)} cm)
                        </p>
                        <p><span className="font-medium">Forklift:</span> {formatNumber(forkliftClearance)} cm</p>
                        <p className={`mt-1 font-semibold ${displayStd.fits ? "text-green-700" : "text-red-700"}`}>
                          Total: {formatNumber(displayStd.totalHeightCm)} cm
                          {displayStd.fits ? " - Fits" : " - Does not fit"} (239 cm)
                        </p>
                      </div>
                    </div>

                    <div className={`space-y-1 rounded-md border p-3 text-sm ${displayHq.fits ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{"40'HQ Container"}</p>
                      <p><span className="font-medium">Layers:</span> {displayHq.layerCount}</p>
                      <p><span className="font-medium">Cartons / Pallet:</span> {displayHq.cartonsPerPallet}</p>
                      <p><span className="font-medium">Items / Pallet:</span> {displayHq.itemsPerPallet.toLocaleString()}</p>
                      <p><span className="font-medium">Gross Weight:</span> {formatNumber(displayHq.palletGrossWeightKg)} kg</p>
                      <div className="mt-1 border-t border-slate-200 pt-1">
                        <p><span className="font-medium">Pallet:</span> {formatNumber(Number(selectedProfile?.height_cm ?? 0))} cm</p>
                        <p>
                          <span className="font-medium">Stack:</span> {formatNumber(displayHq.stackHeightCm)} cm
                          {" "}({displayHq.layerCount} x {formatNumber(displayHq.layerCount > 0 ? displayHq.stackHeightCm / displayHq.layerCount : 0)} cm)
                        </p>
                        <p><span className="font-medium">Forklift:</span> {formatNumber(forkliftClearance)} cm</p>
                        <p className={`mt-1 font-semibold ${displayHq.fits ? "text-green-700" : "text-red-700"}`}>
                          Total: {formatNumber(displayHq.totalHeightCm)} cm
                          {displayHq.fits ? " - Fits" : " - Does not fit"} (269.8 cm)
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
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Top View</CardTitle>
                </CardHeader>
                <CardContent>
                  {editMode && calculationCarton && selectedProfile ? (
                    <PalletCanvasEditor
                      carton={calculationCarton}
                      editCartons={editCartons}
                      onToggleRotation={() => setPlacementRotated((rotated) => !rotated)}
                      onUpdate={setEditCartons}
                      palletLengthCm={Number(selectedProfile.length_cm)}
                      palletWidthCm={Number(selectedProfile.width_cm)}
                      placementRotated={placementRotated}
                    />
                  ) : (
                    <div className="overflow-auto" dangerouslySetInnerHTML={{ __html: topViewSvg }} />
                  )}
                </CardContent>
              </Card>

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
                  <Button disabled={!exportProductId || !displayStd || !displayHq || isExporting} onClick={handleExportToProduct} variant="outline">
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

function PalletCanvasEditor({
  carton,
  editCartons,
  onToggleRotation,
  onUpdate,
  palletLengthCm,
  palletWidthCm,
  placementRotated,
}: {
  carton: CartonInput;
  editCartons: PlacedCarton[];
  onUpdate: (cartons: PlacedCarton[]) => void;
  palletLengthCm: number;
  palletWidthCm: number;
  placementRotated: boolean;
  onToggleRotation: () => void;
}) {
  const scale = 3;
  const svgWidth = palletLengthCm * scale;
  const svgHeight = palletWidthCm * scale;
  const cartonLength = carton.lengthCm;
  const cartonWidth = carton.widthCm;
  const placeWidth = placementRotated ? cartonWidth : cartonLength;
  const placeHeight = placementRotated ? cartonLength : cartonWidth;
  const snapStep = Math.min(cartonLength, cartonWidth);

  function snapCoord(value: number, step: number) {
    return Math.round(value / step) * step;
  }

  function overlaps(a: PlacedCarton, b: PlacedCarton) {
    const aWidth = a.rotated ? cartonWidth : cartonLength;
    const aHeight = a.rotated ? cartonLength : cartonWidth;
    const bWidth = b.rotated ? cartonWidth : cartonLength;
    const bHeight = b.rotated ? cartonLength : cartonWidth;

    return !(a.x + aWidth <= b.x || b.x + bWidth <= a.x || a.y + aHeight <= b.y || b.y + bHeight <= a.y);
  }

  function hitTest(pointerX: number, pointerY: number) {
    for (let i = editCartons.length - 1; i >= 0; i--) {
      const cartonItem = editCartons[i];
      const width = cartonItem.rotated ? cartonWidth : cartonLength;
      const height = cartonItem.rotated ? cartonLength : cartonWidth;
      if (
        pointerX >= cartonItem.x &&
        pointerX < cartonItem.x + width &&
        pointerY >= cartonItem.y &&
        pointerY < cartonItem.y + height
      ) {
        return i;
      }
    }

    return -1;
  }

  function handleSvgClick(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - rect.left) / scale;
    const pointerY = (event.clientY - rect.top) / scale;
    const hit = hitTest(pointerX, pointerY);

    if (hit >= 0) {
      onUpdate(editCartons.filter((_, index) => index !== hit));
      return;
    }

    const x = snapCoord(pointerX, snapStep);
    const y = snapCoord(pointerY, snapStep);
    const newCarton: PlacedCarton = { rotated: placementRotated, x, y };

    if (x < 0 || y < 0 || x + placeWidth > palletLengthCm || y + placeHeight > palletWidthCm) {
      return;
    }

    if (editCartons.some((existing) => overlaps(newCarton, existing))) {
      return;
    }

    onUpdate([...editCartons, newCarton]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-500">
          {editCartons.length} cartons placed - Click pallet to add - Click carton to remove
        </span>
        <Button
          onClick={onToggleRotation}
          size="sm"
          type="button"
          variant={placementRotated ? "default" : "outline"}
        >
          {placementRotated ? "Rotated (W x L)" : "Normal (L x W)"}
        </Button>
      </div>
      <svg
        className="cursor-pointer rounded border border-slate-200"
        height={svgHeight}
        onClick={handleSvgClick}
        style={{ display: "block" }}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width={svgWidth}
      >
        <rect fill="#f8fafc" height={svgHeight} stroke="#94a3b8" strokeWidth={1.5} width={svgWidth} x={0} y={0} />
        {editCartons.map((cartonItem, index) => {
          const width = (cartonItem.rotated ? cartonWidth : cartonLength) * scale;
          const height = (cartonItem.rotated ? cartonLength : cartonWidth) * scale;

          return (
            <g key={`${cartonItem.x}-${cartonItem.y}-${cartonItem.rotated}-${index}`}>
              <rect
                fill={cartonItem.rotated ? "#bfdbfe" : "#bae6fd"}
                height={Math.max(0, height - 2)}
                stroke={cartonItem.rotated ? "#3b82f6" : "#0ea5e9"}
                strokeWidth={1}
                width={Math.max(0, width - 2)}
                x={cartonItem.x * scale + 1}
                y={cartonItem.y * scale + 1}
              />
              <text
                dominantBaseline="middle"
                fill="#1e3a5f"
                fontSize={Math.min(width, height) * 0.35}
                textAnchor="middle"
                x={cartonItem.x * scale + width / 2}
                y={cartonItem.y * scale + height / 2}
              >
                {index + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-slate-400">
        Pallet: {palletLengthCm} x {palletWidthCm} cm - Carton: {cartonLength} x {cartonWidth} cm (L x W) -
        Blue = normal, light blue = rotated
      </p>
    </div>
  );
}
