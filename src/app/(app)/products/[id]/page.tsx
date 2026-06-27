import Link from "next/link";
import { notFound } from "next/navigation";

import { CartonLabelButton } from "@/components/products/CartonLabelButton";
import { ProductFormDialog, type ProductSupplierOption } from "@/components/products/ProductFormDialog";
import { ProductImagesEditor } from "@/components/products/ProductImagesEditor";
import { ProductStatusButton } from "@/components/products/ProductStatusButton";
import { SetComponentsEditor } from "@/components/products/SetComponentsEditor";
import { SetCostCalculator } from "@/components/products/SetCostCalculator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product, ProductComponent, ProductCostHistory } from "@/types";

const productTypeClasses: Record<Product["product_type"], string> = {
  part: "border-slate-200 bg-slate-100 text-slate-700",
  set: "border-blue-200 bg-blue-50 text-blue-700",
};

const paymentCategoryClasses: Record<NonNullable<Product["payment_category"]>, string> = {
  outsourced: "border-blue-200 bg-blue-50 text-blue-700",
  produced: "border-violet-200 bg-violet-50 text-violet-700",
};

function StatusBadge({ status }: { status: Product["status"] }) {
  return (
    <Badge
      className={
        status === "active"
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }
      variant="outline"
    >
      {status}
    </Badge>
  );
}

function ProductTypeBadge({ type }: { type: Product["product_type"] }) {
  return (
    <Badge className={productTypeClasses[type]} variant="outline">
      {type === "part" ? "product" : "set"}
    </Badge>
  );
}

function PaymentCategoryBadge({ category }: { category: Product["payment_category"] }) {
  if (!category) {
    return <span className="text-sm text-slate-400">-</span>;
  }

  return (
    <Badge className={paymentCategoryClasses[category]} variant="outline">
      {category}
    </Badge>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-[#0d1b34]">{value || "-"}</p>
    </div>
  );
}

function formatRmb(value: number | null | undefined) {
  return typeof value === "number" ? `¥${value.toFixed(4)}` : "-";
}

function formatPackagingValue(value: number | null | undefined, suffix = "") {
  if (typeof value !== "number") {
    return "-";
  }

  return `${Number.isInteger(value) ? value.toFixed(0) : value.toString()}${suffix}`;
}

function formatWholeNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = typeof value === "number" ? value : Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return Math.round(numericValue).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function hasNumberValue(value: number | null | undefined) {
  return typeof value === "number";
}

function calculateQtyItemsPerPallet(product: Product, cartonsPerPallet: number | null | undefined) {
  if (typeof product.qty_per_carton !== "number" || typeof cartonsPerPallet !== "number") {
    return null;
  }

  return product.qty_per_carton * cartonsPerPallet;
}

function ProductPalletDiagramView({ diagram }: { diagram: Product["pallet_diagram"] }) {
  if (!diagram || !diagram.cartons.length) return null;

  const palletLength = Number(diagram.pallet_length_cm);
  const palletWidth = Number(diagram.pallet_width_cm);
  const cartonLength = Number(diagram.carton_length_cm);
  const cartonWidth = Number(diagram.carton_width_cm);

  if (![palletLength, palletWidth, cartonLength, cartonWidth].every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }

  const scale = Math.min(520 / palletLength, 300 / palletWidth);
  const svgWidth = palletLength * scale;
  const svgHeight = palletWidth * scale;

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pallet Diagram</p>
      <div className="mt-3 overflow-auto">
        <svg
          className="rounded border border-slate-200 bg-white"
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width={svgWidth}
        >
          <rect fill="#f8fafc" height={svgHeight} stroke="#94a3b8" strokeWidth={1.5} width={svgWidth} x={0} y={0} />
          {diagram.cartons.map((carton, index) => {
            const width = (carton.rotated ? cartonWidth : cartonLength) * scale;
            const height = (carton.rotated ? cartonLength : cartonWidth) * scale;
            return (
              <g key={`${index}-${carton.x}-${carton.y}-${String(carton.rotated)}`}>
                <rect
                  fill={carton.rotated ? "#bfdbfe" : "#bae6fd"}
                  height={Math.max(0, height - 2)}
                  stroke={carton.rotated ? "#3b82f6" : "#0ea5e9"}
                  strokeWidth={1}
                  width={Math.max(0, width - 2)}
                  x={carton.x * scale + 1}
                  y={carton.y * scale + 1}
                />
                <text
                  dominantBaseline="middle"
                  fill="#1e3a5f"
                  fontSize={Math.min(width, height) * 0.35}
                  textAnchor="middle"
                  x={carton.x * scale + width / 2}
                  y={carton.y * scale + height / 2}
                >
                  {index + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {diagram.cartons.length} cartons per layer / Pallet {formatPackagingValue(palletLength)} x{" "}
        {formatPackagingValue(palletWidth)} cm
      </p>
    </div>
  );
}

function formatCartonFlag(value: string | null | undefined) {
  return value ? "Yes" : "No";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { from?: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Products are available to signed-in users only.</p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const [
    { data, error },
    { data: suppliers, error: suppliersError },
    { data: availableProducts, error: availableProductsError },
    { data: costHistory, error: costHistoryError },
  ] = await Promise.all([
    supabase.from("products").select("*, supplier:suppliers(id, name, code)").eq("id", params.id).maybeSingle(),
    supabase.from("suppliers").select("id, name, code").eq("status", "active").order("code", { ascending: true }),
    supabase
      .from("products")
      .select("*, supplier:suppliers(id, name, code)")
      .eq("product_type", "part")
      .eq("status", "active")
      .order("code", { ascending: true }),
    supabase
      .from("product_cost_history")
      .select("*, supplier:suppliers(id, code, name)")
      .eq("product_id", params.id)
      .order("quoted_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (error || suppliersError || availableProductsError || costHistoryError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error?.message ?? suppliersError?.message ?? availableProductsError?.message ?? costHistoryError?.message}
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const product = data as Product;
  const canManage = user.role === "admin" || user.role === "manager";
  const isPartner = user.role === "partner";

  if (isPartner && !product.code.toUpperCase().startsWith("MLP-")) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">This product is outside your access scope.</p>
        </div>
      </div>
    );
  }

  const backHref = searchParams?.from?.startsWith("/products") ? searchParams.from : "/products?tab=products";
  const supplierOptions = (suppliers ?? []) as ProductSupplierOption[];
  const availableProductOptions = (availableProducts ?? []) as Product[];
  const costHistoryRows = (costHistory ?? []) as ProductCostHistory[];
  const latestCost = costHistoryRows[0] ?? null;
  let setComponents: ProductComponent[] = [];
  let latestCostsByProductId: Record<string, ProductCostHistory | null> = {};

  if (product.product_type === "set") {
    const { data: components, error: componentsError } = await supabase
      .from("product_components")
      .select(
        "*, component:products!product_components_component_product_id_fkey(id, code, supplier_product_code, name_english, name_chinese, product_type, supplier_id, payment_category, status, notes, packaging_required, has_carton, product_length_cm, product_width_cm, product_height_cm, product_weight_kg, product_art_notes, qty_per_carton, carton_height_cm, carton_width_cm, carton_length_cm, carton_weight_kg, cartons_per_pallet_std, cartons_per_pallet_hq, pallet_diagram, country_of_origin, product_images, created_at, updated_at, supplier:suppliers(id, name, code))"
      )
      .eq("set_product_id", params.id)
      .order("sort_order", { ascending: true });

    if (componentsError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {componentsError.message}
        </div>
      );
    }

    setComponents = (components ?? []) as ProductComponent[];
    const componentIds = Array.from(new Set(setComponents.map((component) => component.component_product_id)));

    if (componentIds.length) {
      const { data: componentCosts, error: componentCostsError } = await supabase
        .from("product_cost_history")
        .select("*, supplier:suppliers(id, code, name), product:products(id, code, name_english)")
        .in("product_id", componentIds)
        .order("quoted_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (componentCostsError) {
        return (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {componentCostsError.message}
          </div>
        );
      }

      for (const cost of (componentCosts ?? []) as ProductCostHistory[]) {
        if (!latestCostsByProductId[cost.product_id]) {
          latestCostsByProductId[cost.product_id] = cost;
        }
      }

      for (const componentId of componentIds) {
        latestCostsByProductId[componentId] ??= null;
      }
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <Link className="text-sm font-medium text-slate-500 transition-colors hover:text-[#0d1b34]" href={backHref}>
          Back to Products
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-[#0d1b34]">{product.name_english}</h1>
          <StatusBadge status={product.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Main Info</CardTitle>
              {canManage ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <CartonLabelButton productId={product.id} />
                  <ProductFormDialog
                    initialData={product}
                    mode="edit"
                    suppliers={supplierOptions}
                    trigger={
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <DetailRow label="Rock Hill Product Code" value={product.code} />
                <DetailRow label="Supplier Product Code" value={product.supplier_product_code} />
                <DetailRow label="English Name" value={product.name_english} />
                <DetailRow label="Chinese Name" value={product.name_chinese} />
                <div className="border-b border-slate-100 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product Type</p>
                  <div className="mt-1">
                    <ProductTypeBadge type={product.product_type} />
                  </div>
                </div>
                <DetailRow
                  label="Supplier"
                  value={product.supplier?.code ?? null}
                />
                {product.product_type === "set" ? <DetailRow label="Carton" value={product.has_carton ? "Yes" : "No"} /> : null}
                <div className="border-b border-slate-100 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Category</p>
                  <div className="mt-1">
                    <PaymentCategoryBadge category={product.payment_category} />
                  </div>
                </div>
                <div className="border-b border-slate-100 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                  <div className="mt-2 flex items-center gap-3">
                    <StatusBadge status={product.status} />
                    {canManage ? <ProductStatusButton productId={product.id} status={product.status} /> : null}
                  </div>
                </div>
                <DetailRow label="Created" value={formatDate(product.created_at)} />
                <DetailRow label="Updated" value={formatDate(product.updated_at)} />
              </div>
              <DetailRow label="Notes" value={product.notes} />
            </CardContent>
          </Card>

          {product.product_type === "set" ? (
            <>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Set Builder</CardTitle>
                </CardHeader>
                <CardContent>
                  <SetComponentsEditor
                    availableProducts={availableProductOptions}
                    canManage={canManage}
                    initialComponents={setComponents}
                    setProductId={product.id}
                  />
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Calculated Set Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <SetCostCalculator
                    initialComponents={setComponents}
                    latestCostsByProductId={latestCostsByProductId}
                    setProductId={product.id}
                  />
                </CardContent>
              </Card>
            </>
          ) : null}

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Product Specification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {hasNumberValue(product.product_height_cm) ||
              hasNumberValue(product.product_width_cm) ||
              hasNumberValue(product.product_length_cm) ? (
                <div>
                  <p className="text-xs text-slate-500">Dimensions (L x W x H)</p>
                  <p className="font-medium text-[#0d1b34]">
                    {product.product_length_cm ?? "-"} x {product.product_width_cm ?? "-"} x{" "}
                    {product.product_height_cm ?? "-"} cm
                  </p>
                </div>
              ) : null}
              {hasNumberValue(product.product_weight_kg) ? (
                <div>
                  <p className="text-xs text-slate-500">Weight</p>
                  <p className="font-medium text-[#0d1b34]">{product.product_weight_kg} kg</p>
                </div>
              ) : null}
              {product.product_art_notes ? (
                <div>
                  <p className="text-xs text-slate-500">Art / Design Notes</p>
                  <p className="whitespace-pre-wrap text-[#0d1b34]">{product.product_art_notes}</p>
                </div>
              ) : null}
              {!hasNumberValue(product.product_height_cm) &&
              !hasNumberValue(product.product_width_cm) &&
              !hasNumberValue(product.product_length_cm) &&
              !hasNumberValue(product.product_weight_kg) &&
              !product.product_art_notes ? (
                <p className="text-slate-400">No specification entered.</p>
              ) : null}
            </CardContent>
          </Card>

          {product.packaging_required ? (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Packaging Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <DetailRow label="Qty per Carton" value={formatWholeNumber(product.qty_per_carton)} />
                  <DetailRow
                    label="Carton Dimensions"
                    value={`${formatPackagingValue(product.carton_length_cm)} L x ${formatPackagingValue(
                      product.carton_width_cm
                    )} W x ${formatPackagingValue(product.carton_height_cm)} H cm`}
                  />
                  <DetailRow label="Carton Weight" value={formatPackagingValue(product.carton_weight_kg, " kg")} />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cartons / Pallet (20 ft & 40 ft)
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0d1b34]">
                      {formatPackagingValue(product.cartons_per_pallet_std)}
                    </p>
                    <div className="my-3 border-t border-slate-200" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      QTY Items / Pallet (20 ft & 40 ft)
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0d1b34]">
                      {formatWholeNumber(calculateQtyItemsPerPallet(product, product.cartons_per_pallet_std))}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cartons / Pallet (40 ft HQ)
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0d1b34]">
                      {formatPackagingValue(product.cartons_per_pallet_hq)}
                    </p>
                    <div className="my-3 border-t border-slate-200" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      QTY Items / Pallet (40 ft HQ)
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#0d1b34]">
                      {formatWholeNumber(calculateQtyItemsPerPallet(product, product.cartons_per_pallet_hq))}
                    </p>
                  </div>
                </div>
                <ProductPalletDiagramView diagram={product.pallet_diagram} />
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Cost History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest Cost</p>
                  <p className="mt-1 text-2xl font-semibold text-[#0d1b34]">{formatRmb(latestCost?.unit_cost_rmb)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest MOQ</p>
                  <p className="mt-1 text-sm text-[#0d1b34]">{formatWholeNumber(latestCost?.moq)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest Date</p>
                  <p className="mt-1 text-sm text-[#0d1b34]">
                    {latestCost ? formatDate(latestCost.quoted_date) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</p>
                  <p className="mt-1 text-sm text-[#0d1b34]">{latestCost?.source ?? "-"}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier Code</TableHead>
                    <TableHead className="w-[6ch]">MOQ</TableHead>
                    <TableHead className="w-[8ch] text-right">Unit (RMB)</TableHead>
                    <TableHead className="min-w-[14rem]">Quality</TableHead>
                    <TableHead className="w-[7ch]">Carton</TableHead>
                    <TableHead className="min-w-[20rem]">Notes</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costHistoryRows.length ? (
                    costHistoryRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.quoted_date)}</TableCell>
                        <TableCell>{row.supplier_product_code ?? "-"}</TableCell>
                        <TableCell>{formatWholeNumber(row.moq)}</TableCell>
                        <TableCell className="text-right font-medium text-[#0d1b34]">
                          {formatRmb(row.unit_cost_rmb)}
                        </TableCell>
                        <TableCell>{row.quality ?? "-"}</TableCell>
                        <TableCell>{formatCartonFlag(row.carton_box_packaging)}</TableCell>
                        <TableCell>{row.notes ?? "-"}</TableCell>
                        <TableCell>{row.source}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="text-slate-500" colSpan={8}>
                        No cost history yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Product Image</CardTitle>
            </CardHeader>
            <CardContent>
                  <ProductImagesEditor canManage={canManage} initialImages={product.product_images} productId={product.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
