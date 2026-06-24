"use client";

import { Download, Loader2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { generatePalletCalculationPdf } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildPalletSideViewSvg,
  buildPalletTopViewSvg,
  calculatePallet,
  CONTAINER_PRESETS,
  type CartonInput,
  type PalletInput,
} from "@/lib/pallet-calculator";
import type { Product } from "@/types";

const DEFAULT_PALLET = {
  heightCm: "160",
  lengthCm: "120",
  maxWeightKg: "1000",
  widthCm: "100",
};

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inputValue(value: number | null | undefined, fallback = "") {
  return typeof value === "number" ? String(value) : fallback;
}

export function PalletCalculatorClient({ products }: { products: Product[] }) {
  const [selectedProductId, setSelectedProductId] = useState("manual");
  const [productName, setProductName] = useState("");
  const [cartonLengthCm, setCartonLengthCm] = useState("");
  const [cartonWidthCm, setCartonWidthCm] = useState("");
  const [cartonHeightCm, setCartonHeightCm] = useState("");
  const [cartonWeightKg, setCartonWeightKg] = useState("");
  const [qtyPerCarton, setQtyPerCarton] = useState("");
  const [palletLengthCm, setPalletLengthCm] = useState(DEFAULT_PALLET.lengthCm);
  const [palletWidthCm, setPalletWidthCm] = useState(DEFAULT_PALLET.widthCm);
  const [palletHeightCm, setPalletHeightCm] = useState(DEFAULT_PALLET.heightCm);
  const [palletMaxWeightKg, setPalletMaxWeightKg] = useState(DEFAULT_PALLET.maxWeightKg);
  const [containerPallets, setContainerPallets] = useState("");
  const [isPending, startTransition] = useTransition();

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
  const pallet: PalletInput = useMemo(
    () => ({
      lengthCm: numberValue(palletLengthCm),
      maxHeightCm: numberValue(palletHeightCm),
      maxWeightKg: numberValue(palletMaxWeightKg),
      widthCm: numberValue(palletWidthCm),
    }),
    [palletHeightCm, palletLengthCm, palletMaxWeightKg, palletWidthCm]
  );
  const canCalculate =
    carton.lengthCm > 0 &&
    carton.widthCm > 0 &&
    carton.heightCm > 0 &&
    carton.weightKg > 0 &&
    carton.qtyPerCarton > 0 &&
    pallet.lengthCm > 0 &&
    pallet.widthCm > 0 &&
    pallet.maxHeightCm > 0 &&
    pallet.maxWeightKg > 0;
  const calculation = useMemo(() => (canCalculate ? calculatePallet(carton, pallet) : null), [canCalculate, carton, pallet]);
  const topViewSvg = calculation ? buildPalletTopViewSvg(carton, pallet, calculation) : "";
  const sideViewSvg = calculation ? buildPalletSideViewSvg(carton, pallet, calculation) : "";
  const containerItems = calculation && Number(containerPallets) > 0
    ? calculation.itemsPerPallet * Number(containerPallets)
    : null;

  function selectProduct(productId: string) {
    setSelectedProductId(productId);

    if (productId === "manual") {
      setProductName("");
      return;
    }

    const product = products.find((row) => row.id === productId);

    if (!product) {
      return;
    }

    setProductName(product.name_english);
    setCartonLengthCm(inputValue(product.carton_length_cm));
    setCartonWidthCm(inputValue(product.carton_width_cm));
    setCartonHeightCm(inputValue(product.carton_height_cm));
    setCartonWeightKg(inputValue(product.carton_weight_kg));
    setQtyPerCarton(inputValue(product.qty_per_carton));
    setPalletLengthCm(inputValue(product.pallet_length_cm, DEFAULT_PALLET.lengthCm));
    setPalletWidthCm(inputValue(product.pallet_width_cm, DEFAULT_PALLET.widthCm));
    setPalletHeightCm(inputValue(product.pallet_height_cm, DEFAULT_PALLET.heightCm));
    setPalletMaxWeightKg(inputValue(product.pallet_max_weight_kg, DEFAULT_PALLET.maxWeightKg));
    setContainerPallets(inputValue(product.cartons_per_pallet));
  }

  function applyContainerPreset(preset: keyof typeof CONTAINER_PRESETS) {
    setContainerPallets(String(CONTAINER_PRESETS[preset].pallets));
  }

  function exportPdf() {
    if (!canCalculate) {
      toast.error("Enter carton and pallet details first");
      return;
    }

    const formData = new FormData();
    formData.set("product_name", productName || "Manual product");
    formData.set("carton_length_cm", cartonLengthCm);
    formData.set("carton_width_cm", cartonWidthCm);
    formData.set("carton_height_cm", cartonHeightCm);
    formData.set("carton_weight_kg", cartonWeightKg);
    formData.set("qty_per_carton", qtyPerCarton);
    formData.set("pallet_length_cm", palletLengthCm);
    formData.set("pallet_width_cm", palletWidthCm);
    formData.set("pallet_height_cm", palletHeightCm);
    formData.set("pallet_max_weight_kg", palletMaxWeightKg);
    formData.set("container_pallets", containerPallets);

    startTransition(async () => {
      const result = await generatePalletCalculationPdf(formData);

      if (result.error || !result.url) {
        toast.error(result.error ?? "Could not generate PDF");
        return;
      }

      const link = document.createElement("a");
      link.href = result.url;
      link.download = "pallet-calculation.pdf";
      link.click();
      toast.success("Pallet PDF generated");
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0d1b34]">Pallet Calculator</h1>
          <p className="mt-2 text-sm text-slate-500">Calculate carton loading, pallet weight, and container totals.</p>
        </div>
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={exportPdf}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export PDF
        </Button>
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Pallet L (cm)</Label>
                <Input min="0" onChange={(event) => setPalletLengthCm(event.target.value)} step="0.01" type="number" value={palletLengthCm} />
              </div>
              <div className="space-y-2">
                <Label>Pallet W (cm)</Label>
                <Input min="0" onChange={(event) => setPalletWidthCm(event.target.value)} step="0.01" type="number" value={palletWidthCm} />
              </div>
              <div className="space-y-2">
                <Label>Max Height (cm)</Label>
                <Input min="0" onChange={(event) => setPalletHeightCm(event.target.value)} step="0.01" type="number" value={palletHeightCm} />
              </div>
              <div className="space-y-2">
                <Label>Max Weight (kg)</Label>
                <Input min="0" onChange={(event) => setPalletMaxWeightKg(event.target.value)} step="0.01" type="number" value={palletMaxWeightKg} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Container Pallets</Label>
              <Input min="0" onChange={(event) => setContainerPallets(event.target.value)} step="1" type="number" value={containerPallets} />
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CONTAINER_PRESETS) as Array<keyof typeof CONTAINER_PRESETS>).map((key) => (
                  <Button key={key} onClick={() => applyContainerPreset(key)} size="sm" type="button" variant="outline">
                    {CONTAINER_PRESETS[key].label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ["Cartons / Layer", calculation?.cartonsPerLayer],
              ["Cartons / Pallet", calculation?.cartonsPerPallet],
              ["Items / Pallet", calculation?.itemsPerPallet],
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

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Calculation</CardTitle>
            </CardHeader>
            <CardContent>
              {calculation ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Best Orientation</p>
                    <p className="mt-1 text-sm font-semibold text-[#0d1b34]">{calculation.orientation}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gross Weight</p>
                    <p className="mt-1 text-sm font-semibold text-[#0d1b34]">{calculation.palletGrossWeightKg} kg</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Footprint Used</p>
                    <p className="mt-1 text-sm font-semibold text-[#0d1b34]">{calculation.footprintUsedPct}%</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Enter carton and pallet details to calculate.</p>
              )}
            </CardContent>
          </Card>

          {calculation ? (
            <div className="grid gap-6 xl:grid-cols-2">
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
                  <CardTitle>Side View</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto" dangerouslySetInnerHTML={{ __html: sideViewSvg }} />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
