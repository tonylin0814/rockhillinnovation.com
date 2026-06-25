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
  if (value === null || value === undefined || value === "") return "";
  const normalized = normalizeIntegerInput(String(value));
  if (!normalized) return "";
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
  const defaultProfile = palletProfiles.find((p) => p.is_default) ?? palletProfiles[0] ?? null;
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
    cartons: PlacedCarton[];
    cartonsPerLayer: number;
    stdLayerCount: number; stdCartonsPerPallet: number; stdItemsPerPallet: number; stdGrossWeight: number;
    hqLayerCount: number;  hqCartonsPerPallet: number;  hqItemsPerPallet: number;  hqGrossWeight: number;
    cartonsAlongLength: number; cartonsAlongWidth: number; orientation: string;
  } | null>(null);
  const [editCartons, setEditCartons] = useState<PlacedCarton[]>([]);
  const [placementRotated, setPlacementRotated] = useState(false);
  const [editStdLayers, setEditStdLayers] = useState(0);
  const [editStdCartonsPallet, setEditStdCartonsPallet] = useState(0);
  const [editStdItemsPallet, setEditStdItemsPallet] = useState(0);
  const [editStdGrossWeight, setEditStdGrossWeight] = useState(0);
  const [editHqLayers, setEditHqLayers] = useState(0);
  const [editHqCartonsPallet, setEditHqCartonsPallet] = useState(0);
  const [editHqItemsPallet, setEditHqItemsPallet] = useState(0);
  const [editHqGrossWeight, setEditHqGrossWeight] = useState(0);
  const [editCartonsAlongLength, setEditCartonsAlongLength] = useState(0);
  const [editCartonsAlongWidth, setEditCartonsAlongWidth] = useState(0);
  const [editOrientation, setEditOrientation] = useState("");
  const [isCalculating, startCalculation] = useTransition();
  const [isExporting, startExport] = useTransition();

  const selectedProfile = useMemo(
    () => palletProfiles.find((p) => p.id === selectedProfileId) ?? null,
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
    carton.lengthCm > 0 && carton.widthCm > 0 && carton.heightCm > 0 &&
    carton.weightKg > 0 && carton.qtyPerCarton > 0 && forkliftClearance >= 0;

  const standardPlan = judyResult?.standardPlan ?? null;
  const hqPlan = judyResult?.hqPlan ?? null;
  const palletHeightCm = selectedProfile ? Number(selectedProfile.height_cm) : 0;

  const displayCartonsPerLayer = editMode
    ? (editCartons.length > 0 ? editCartons.length : editCartonsAlongLength * editCartonsAlongWidth)
    : (editOverride?.cartonsPerLayer ?? judyResult?.layerSetup.cartonsPerLayer ?? null);
  const displayStdLayerCount = editMode ? editStdLayers : (editOverride?.stdLayerCount ?? standardPlan?.layerCount ?? 0);
  const displayHqLayerCount  = editMode ? editHqLayers  : (editOverride?.hqLayerCount  ?? hqPlan?.layerCount  ?? 0);

  function buildEditDisplay(
    layerCount: number, cartonsPerPallet: number, itemsPerPallet: number,
    grossWeight: number, containerMaxH: number
  ): JudyPalletResult["standardPlan"] {
    const stackHeightCm = layerCount * (calculationCarton?.heightCm ?? 0);
    const totalHeightCm = palletHeightCm + stackHeightCm + forkliftClearance;
    return { cartonsPerPallet, fits: totalHeightCm <= containerMaxH, itemsPerPallet, layerCount, palletGrossWeightKg: grossWeight, stackHeightCm, totalHeightCm };
  }

  const displayStd = editMode
    ? buildEditDisplay(editStdLayers, editStdCartonsPallet, editStdItemsPallet, editStdGrossWeight, CONTAINER_HEIGHTS_CM.std)
    : editOverride
      ? buildEditDisplay(editOverride.stdLayerCount, editOverride.stdCartonsPerPallet, editOverride.stdItemsPerPallet, editOverride.stdGrossWeight, CONTAINER_HEIGHTS_CM.std)
      : standardPlan;
  const displayHq = editMode
    ? buildEditDisplay(editHqLayers, editHqCartonsPallet, editHqItemsPallet, editHqGrossWeight, CONTAINER_HEIGHTS_CM["40hq"])
    : editOverride
      ? buildEditDisplay(editOverride.hqLayerCount, editOverride.hqCartonsPerPallet, editOverride.hqItemsPerPallet, editOverride.hqGrossWeight, CONTAINER_HEIGHTS_CM["40hq"])
      : hqPlan;

  const activePlan = containerType === "40hq" ? displayHq : displayStd;
  const containerItems = activePlan ? activePlan.itemsPerPallet * CONTAINER_PRESETS[containerType].pallets : null;
  const drawingCalculation = judyResult && activePlan ? buildDrawingCalculation(judyResult, activePlan) : null;
  const topViewSvg = drawingCalculation && calculationCarton && palletInput
    ? buildPalletTopViewSvg(calculationCarton, palletInput, drawingCalculation) : "";
  const canvasCartons = editMode ? editCartons : editOverride?.cartons ?? [];

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

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    setExportProductId(productId === "manual" ? "" : productId);
    if (productId === "manual") { setProductName(""); return; }
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
    if (!judyResult || !standardPlan || !hqPlan) return;
    const { cartonsAlongLength, cartonsAlongWidth } = judyResult.layerSetup;
    const savedCartons = editOverride?.cartons ?? [];
    setEditCartons(
      savedCartons.length > 0
        ? savedCartons.map((carton) => ({ ...carton }))
        : buildCartonGrid(cartonsAlongLength, cartonsAlongWidth, false)
    );
    setEditStdLayers(editOverride?.stdLayerCount ?? standardPlan.layerCount);
    setEditStdCartonsPallet(editOverride?.stdCartonsPerPallet ?? standardPlan.cartonsPerPallet);
    setEditStdItemsPallet(editOverride?.stdItemsPerPallet ?? standardPlan.itemsPerPallet);
    setEditStdGrossWeight(editOverride?.stdGrossWeight ?? standardPlan.palletGrossWeightKg);
    setEditHqLayers(editOverride?.hqLayerCount ?? hqPlan.layerCount);
    setEditHqCartonsPallet(editOverride?.hqCartonsPerPallet ?? hqPlan.cartonsPerPallet);
    setEditHqItemsPallet(editOverride?.hqItemsPerPallet ?? hqPlan.itemsPerPallet);
    setEditHqGrossWeight(editOverride?.hqGrossWeight ?? hqPlan.palletGrossWeightKg);
    setEditCartonsAlongLength(editOverride?.cartonsAlongLength ?? cartonsAlongLength);
    setEditCartonsAlongWidth(editOverride?.cartonsAlongWidth ?? cartonsAlongWidth);
    setEditOrientation(editOverride?.orientation ?? judyResult.layerSetup.orientation);
    setPlacementRotated(false);
    setEditMode(true);
  }

  function buildCartonGrid(alongLength: number, alongWidth: number, rotated: boolean) {
    const cartons: PlacedCarton[] = [];
    const stepX = rotated ? calculationCarton?.widthCm ?? 0 : calculationCarton?.lengthCm ?? 0;
    const stepY = rotated ? calculationCarton?.lengthCm ?? 0 : calculationCarton?.widthCm ?? 0;

    for (let i = 0; i < alongLength; i++) {
      for (let j = 0; j < alongWidth; j++) {
        cartons.push({ rotated, x: i * stepX, y: j * stepY });
      }
    }

    return cartons;
  }

  function updateLayerGrid(nextLength: number, nextWidth: number) {
    setEditCartonsAlongLength(nextLength);
    setEditCartonsAlongWidth(nextWidth);
    setEditCartons(buildCartonGrid(nextLength, nextWidth, placementRotated));
  }

  function cancelEditMode() {
    setEditMode(false);
    setEditCartons([]);
  }

  function saveEditMode() {
    const cpl = editCartons.length > 0 ? editCartons.length : editCartonsAlongLength * editCartonsAlongWidth;
    setEditOverride({
      cartons: editCartons.map((carton) => ({ ...carton })),
      cartonsAlongLength: editCartonsAlongLength,
      cartonsAlongWidth: editCartonsAlongWidth,
      cartonsPerLayer: cpl,
      hqCartonsPerPallet: editHqCartonsPallet,
      hqGrossWeight: editHqGrossWeight,
      hqItemsPerPallet: editHqItemsPallet,
      hqLayerCount: editHqLayers,
      orientation: editOrientation,
      stdCartonsPerPallet: editStdCartonsPallet,
      stdGrossWeight: editStdGrossWeight,
      stdItemsPerPallet: editStdItemsPallet,
      stdLayerCount: editStdLayers,
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
      if (aiResult.error) { toast.error(aiResult.error); return; }
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
      if (result.error) { toast.error(result.error); return; }
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
          <CardHeader><CardTitle>Inputs</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select onValueChange={selectProduct} value={selectedProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual entry</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name_english}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name</Label>
              <Input id="product_name" onChange={(e) => setProductName(e.target.value)} value={productName} />
            </div>
            <div className="space-y-2">
              <Label>Pallet Profile</Label>
              <Select onValueChange={setSelectedProfileId} value={selectedProfileId}>
                <SelectTrigger><SelectValue placeholder="Select a pallet profile" /></SelectTrigger>
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
              <Input id="forklift_clearance" min="0" onChange={(e) => setForkliftClearanceCm(e.target.value)} placeholder="19" step="1" type="number" value={forkliftClearanceCm} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Carton L (cm)</Label>
                <Input min="0" onChange={(e) => setCartonLengthCm(e.target.value)} step="0.01" type="number" value={cartonLengthCm} />
              </div>
              <div className="space-y-2">
                <Label>Carton W (cm)</Label>
                <Input min="0" onChange={(e) => setCartonWidthCm(e.target.value)} step="0.01" type="number" value={cartonWidthCm} />
              </div>
              <div className="space-y-2">
                <Label>Carton H (cm)</Label>
                <Input min="0" onChange={(e) => setCartonHeightCm(e.target.value)} step="0.01" type="number" value={cartonHeightCm} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Carton Weight (kg)</Label>
                <Input min="0" onChange={(e) => setCartonWeightKg(e.target.value)} step="0.01" type="number" value={cartonWeightKg} />
              </div>
              <div className="space-y-2">
                <Label>Qty / Carton</Label>
                <Input inputMode="numeric" onChange={(e) => setQtyPerCarton(formatIntegerInput(e.target.value))} type="text" value={qtyPerCarton} />
              </div>
            </div>
            <Button className="w-full bg-[#0d1b34] hover:bg-[#13294d]" disabled={!canCalculate || isCalculating} onClick={handleCalculate} type="button">
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
              <Button onClick={enterEditMode} size="sm" type="button" variant="outline">Edit</Button>
            ) : null}
            {editMode ? (
              <div className="flex items-center gap-2">
                <Button className="bg-[#0d1b34] hover:bg-[#13294d]" onClick={saveEditMode} size="sm" type="button">Save</Button>
                <Button onClick={cancelEditMode} size="sm" type="button" variant="outline">Cancel</Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {([
              ["Cartons / Layer", displayCartonsPerLayer],
              ["Cartons / Pallet", activePlan?.cartonsPerPallet],
              ["Items / Pallet", activePlan?.itemsPerPallet],
              ["Container Items", containerItems],
            ] as [string, number | null | undefined][]).map(([label, value]) => (
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
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layer Setup</p>
                    {editMode ? <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">editing</span> : null}
                  </div>
                  {editMode ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Input
                          className="w-14"
                          min={1}
                          onChange={(e) => updateLayerGrid(Math.max(1, Number(e.target.value) || 1), editCartonsAlongWidth)}
                          type="number"
                          value={editCartonsAlongLength}
                        />
                        <span className="text-sm text-slate-400">x</span>
                        <Input
                          className="w-14"
                          min={1}
                          onChange={(e) => updateLayerGrid(editCartonsAlongLength, Math.max(1, Number(e.target.value) || 1))}
                          type="number"
                          value={editCartonsAlongWidth}
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {editCartons.length > 0 ? editCartons.length : editCartonsAlongLength * editCartonsAlongWidth} cartons / layer
                        {editCartons.length > 0 ? " (canvas)" : ""}
                      </p>
                      <Input className="text-xs" onChange={(e) => setEditOrientation(e.target.value)} placeholder="Orientation" value={editOrientation} />
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">
                        {editOverride
                          ? editOverride.cartonsAlongLength + " x " + editOverride.cartonsAlongWidth
                          : judyResult.layerSetup.cartonsAlongLength + " x " + judyResult.layerSetup.cartonsAlongWidth}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{displayCartonsPerLayer} cartons / layer</p>
                    </>
                  )}
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
            <CardHeader><CardTitle>Calculation</CardTitle></CardHeader>
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
                      <p><span className="font-medium">Orientation:</span> {editOverride?.orientation ?? judyResult.layerSetup.orientation}</p>
                      <p>
                        <span className="font-medium">Layout:</span>{" "}
                        {editOverride
                          ? editOverride.cartonsAlongLength + " x " + editOverride.cartonsAlongWidth
                          : judyResult.layerSetup.cartonsAlongLength + " x " + judyResult.layerSetup.cartonsAlongWidth}
                        {" = "}
                        <span className="font-semibold text-[#0d1b34]">{displayCartonsPerLayer} cartons per layer</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={"space-y-2 rounded-md border p-3 text-sm " + (displayStd.fits ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{"20' / 40' Container"}</p>
                      {editMode ? (
                        <>
                          <div className="flex items-center gap-2"><span className="w-32 font-medium">Layers</span><Input className="w-20" min={1} onChange={(e) => setEditStdLayers(Number(e.target.value))} type="number" value={editStdLayers} /></div>
                          <div className="flex items-center gap-2"><span className="w-32 font-medium">Cartons / Pallet</span><Input className="w-20" min={0} onChange={(e) => setEditStdCartonsPallet(Number(e.target.value))} type="number" value={editStdCartonsPallet} /></div>
                          <div className="flex items-center gap-2"><span className="w-32 font-medium">Items / Pallet</span><Input className="w-24" min={0} onChange={(e) => setEditStdItemsPallet(Number(e.target.value))} type="number" value={editStdItemsPallet} /></div>
                          <div className="flex items-center gap-2"><span className="w-32 font-medium">Gross Weight</span><Input className="w-24" min={0} onChange={(e) => setEditStdGrossWeight(Number(e.target.value))} step="0.1" type="number" value={editStdGrossWeight} /><span className="text-xs text-slate-400">kg</span></div>
                        </>
                      ) : (
                        <>
                          <p><span className="font-medium">Layers:</span> {displayStd.layerCount}</p>
                          <p><span className="font-medium">Cartons / Pallet:</span> {displayStd.cartonsPerPallet}</p>
                          <p><span className="font-medium">Items / Pallet:</span> {displayStd.itemsPerPallet.toLocaleString()}</p>
                          <p><span className="font-medium">Gross Weight:</span> {formatNumber(displayStd.palletGrossWeightKg)} kg</p>
                        </>
                      )}
                      <div className="border-t border-slate-200 pt-1 space-y-0.5">
                        <p><span className="font-medium">Pallet:</span> {formatNumber(palletHeightCm)} cm</p>
                        <p><span className="font-medium">Stack:</span> {formatNumber(displayStd.stackHeightCm)} cm ({displayStd.layerCount} x {formatNumber(calculationCarton?.heightCm ?? 0)} cm)</p>
                        <p><span className="font-medium">Forklift:</span> {formatNumber(forkliftClearance)} cm</p>
                        <p className={"mt-1 font-semibold " + (displayStd.fits ? "text-green-700" : "text-red-700")}>
                          {displayStd.fits ? "✓" : "✗"} Total: {formatNumber(displayStd.totalHeightCm)} cm {displayStd.fits ? "- Fits" : "- Does not fit"} (239 cm)
                        </p>
                      </div>
                    </div>

                    <div className={"space-y-2 rounded-md border p-3 text-sm " + (displayHq.fits ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{"40'HQ Container"}</p>
                      {editMode ? (
                        <>
                          <div className="flex items-center gap-2"><span className="w-32 font-medium">Layers</span><Input className="w-20" min={1} onChange={(e) => setEditHqLayers(Number(e.target.value))} type="number" value={editHqLayers} /></div>
                          <div className="flex items-center gap-2"><span className="w-32 font-medium">Cartons / Pallet</span><Input className="w-20" min={0} onChange={(e) => setEditHqCartonsPallet(Number(e.target.value))} type="number" value={editHqCartonsPallet} /></div>
                          <div className="flex items-center gap-2"><span className="w-32 font-medium">Items / Pallet</span><Input className="w-24" min={0} onChange={(e) => setEditHqItemsPallet(Number(e.target.value))} type="number" value={editHqItemsPallet} /></div>
                          <div className="flex items-center gap-2"><span className="w-32 font-medium">Gross Weight</span><Input className="w-24" min={0} onChange={(e) => setEditHqGrossWeight(Number(e.target.value))} step="0.1" type="number" value={editHqGrossWeight} /><span className="text-xs text-slate-400">kg</span></div>
                        </>
                      ) : (
                        <>
                          <p><span className="font-medium">Layers:</span> {displayHq.layerCount}</p>
                          <p><span className="font-medium">Cartons / Pallet:</span> {displayHq.cartonsPerPallet}</p>
                          <p><span className="font-medium">Items / Pallet:</span> {displayHq.itemsPerPallet.toLocaleString()}</p>
                          <p><span className="font-medium">Gross Weight:</span> {formatNumber(displayHq.palletGrossWeightKg)} kg</p>
                        </>
                      )}
                      <div className="border-t border-slate-200 pt-1 space-y-0.5">
                        <p><span className="font-medium">Pallet:</span> {formatNumber(palletHeightCm)} cm</p>
                        <p><span className="font-medium">Stack:</span> {formatNumber(displayHq.stackHeightCm)} cm ({displayHq.layerCount} x {formatNumber(calculationCarton?.heightCm ?? 0)} cm)</p>
                        <p><span className="font-medium">Forklift:</span> {formatNumber(forkliftClearance)} cm</p>
                        <p className={"mt-1 font-semibold " + (displayHq.fits ? "text-green-700" : "text-red-700")}>
                          {displayHq.fits ? "✓" : "✗"} Total: {formatNumber(displayHq.totalHeightCm)} cm {displayHq.fits ? "- Fits" : "- Does not fit"} (269.8 cm)
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
                <CardHeader><CardTitle>Top View</CardTitle></CardHeader>
                <CardContent>
                  {(editMode || canvasCartons.length > 0) && calculationCarton && selectedProfile ? (
                    <PalletCanvasEditor
                      carton={calculationCarton}
                      editCartons={canvasCartons}
                      onToggleRotation={() => setPlacementRotated((r) => !r)}
                      onUpdate={setEditCartons}
                      palletLengthCm={Number(selectedProfile.length_cm)}
                      palletWidthCm={Number(selectedProfile.width_cm)}
                      placementRotated={placementRotated}
                      readOnly={!editMode}
                    />
                  ) : (
                    <div className="overflow-auto" dangerouslySetInnerHTML={{ __html: topViewSvg }} />
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader><CardTitle>Export to Product</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-500">Save carton dimensions and qty/carton to a product in your catalog.</p>
                  <Select onValueChange={setExportProductId} value={exportProductId}>
                    <SelectTrigger><SelectValue placeholder="Select product to update" /></SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>{product.name_english}</SelectItem>
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
  readOnly = false,
}: {
  carton: CartonInput;
  editCartons: PlacedCarton[];
  onUpdate: (cartons: PlacedCarton[]) => void;
  palletLengthCm: number;
  palletWidthCm: number;
  placementRotated: boolean;
  onToggleRotation: () => void;
  readOnly?: boolean;
}) {
  const scale = 3;
  const svgWidth = palletLengthCm * scale;
  const svgHeight = palletWidthCm * scale;
  const cL = carton.lengthCm;
  const cW = carton.widthCm;
  const placeWidth  = placementRotated ? cW : cL;
  const placeHeight = placementRotated ? cL : cW;

  function snapCoord(value: number, step: number) {
    return Math.floor(value / step) * step;
  }

  function isValidPlacement(cartonItem: PlacedCarton) {
    const width = cartonItem.rotated ? cW : cL;
    const height = cartonItem.rotated ? cL : cW;

    return (
      cartonItem.x >= 0 &&
      cartonItem.y >= 0 &&
      cartonItem.x + width <= palletLengthCm &&
      cartonItem.y + height <= palletWidthCm &&
      !editCartons.some((existing) => overlaps(cartonItem, existing))
    );
  }

  function overlaps(a: PlacedCarton, b: PlacedCarton) {
    const aW = a.rotated ? cW : cL;
    const aH = a.rotated ? cL : cW;
    const bW = b.rotated ? cW : cL;
    const bH = b.rotated ? cL : cW;
    return !(a.x + aW <= b.x || b.x + bW <= a.x || a.y + aH <= b.y || b.y + bH <= a.y);
  }

  function hitTest(px: number, py: number) {
    for (let i = editCartons.length - 1; i >= 0; i--) {
      const c = editCartons[i];
      const w = c.rotated ? cW : cL;
      const h = c.rotated ? cL : cW;
      if (px >= c.x && px < c.x + w && py >= c.y && py < c.y + h) return i;
    }
    return -1;
  }

  function handleSvgClick(event: MouseEvent<SVGSVGElement>) {
    if (readOnly) return;
    const svg = event.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const pointerX = svgPt.x / scale;
    const pointerY = svgPt.y / scale;

    const hit = hitTest(pointerX, pointerY);
    if (hit >= 0) {
      onUpdate(editCartons.filter((_, i) => i !== hit));
      return;
    }

    const preferredX = snapCoord(pointerX, placeWidth);
    const preferredY = snapCoord(pointerY, placeHeight);
    const candidates: PlacedCarton[] = [
      { rotated: placementRotated, x: preferredX, y: preferredY },
      { rotated: placementRotated, x: Math.max(0, palletLengthCm - placeWidth), y: preferredY },
      { rotated: placementRotated, x: preferredX, y: Math.max(0, palletWidthCm - placeHeight) },
    ];

    for (let x = 0; x <= palletLengthCm - placeWidth; x += placeWidth) {
      for (let y = 0; y <= palletWidthCm - placeHeight; y += placeHeight) {
        candidates.push({ rotated: placementRotated, x, y });
      }
    }

    const newCarton = candidates.find(isValidPlacement);
    if (!newCarton) return;

    onUpdate([...editCartons, newCarton]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-500">
          {editCartons.length} cartons placed · Click pallet to add · Click carton to remove
        </span>
        <Button onClick={onToggleRotation} size="sm" type="button" variant={placementRotated ? "default" : "outline"}>
          {placementRotated ? "Rotated (WxL)" : "Normal (LxW)"}
        </Button>
      </div>
      <svg
        className="cursor-pointer rounded border border-slate-200"
        height={svgHeight}
        onClick={handleSvgClick}
        style={{ display: "block" }}
        viewBox={"0 0 " + svgWidth + " " + svgHeight}
        width={svgWidth}
      >
        <rect fill="#f8fafc" height={svgHeight} stroke="#94a3b8" strokeWidth={1.5} width={svgWidth} x={0} y={0} />
        {editCartons.map((c, i) => {
          const w = (c.rotated ? cW : cL) * scale;
          const h = (c.rotated ? cL : cW) * scale;
          return (
            <g key={i + "-" + c.x + "-" + c.y + "-" + String(c.rotated)}>
              <rect
                fill={c.rotated ? "#bfdbfe" : "#bae6fd"}
                height={Math.max(0, h - 2)}
                stroke={c.rotated ? "#3b82f6" : "#0ea5e9"}
                strokeWidth={1}
                width={Math.max(0, w - 2)}
                x={c.x * scale + 1}
                y={c.y * scale + 1}
              />
              <text
                dominantBaseline="middle"
                fill="#1e3a5f"
                fontSize={Math.min(w, h) * 0.35}
                textAnchor="middle"
                x={c.x * scale + w / 2}
                y={c.y * scale + h / 2}
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-slate-400">
        Pallet: {palletLengthCm} x {palletWidthCm} cm · Carton: {cL} x {cW} cm (LxW) · Blue = normal, light blue = rotated
      </p>
    </div>
  );
}
