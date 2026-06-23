import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductFormDialog, type ProductSupplierOption } from "@/components/products/ProductFormDialog";
import { ProductImagesEditor } from "@/components/products/ProductImagesEditor";
import { ProductStatusButton } from "@/components/products/ProductStatusButton";
import { SetComponentsEditor } from "@/components/products/SetComponentsEditor";
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (user?.role === "partner") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Products are available to admins and managers only.</p>
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
    supabase.from("suppliers").select("id, name, code").eq("status", "active").order("name", { ascending: true }),
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
  const supplierOptions = (suppliers ?? []) as ProductSupplierOption[];
  const availableProductOptions = (availableProducts ?? []) as Product[];
  const costHistoryRows = (costHistory ?? []) as ProductCostHistory[];
  const latestCost = costHistoryRows[0] ?? null;
  let setComponents: ProductComponent[] = [];

  if (product.product_type === "set") {
    const { data: components, error: componentsError } = await supabase
      .from("product_components")
      .select(
        "*, component:products(id, code, supplier_product_code, name_english, name_chinese, product_type, supplier_id, payment_category, status, notes, created_at, updated_at, supplier:suppliers(id, name, code))"
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
  }

  return (
    <section className="space-y-6">
      <div>
        <Link className="text-sm font-medium text-slate-500 transition-colors hover:text-[#0d1b34]" href="/products">
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
                  value={product.supplier ? `${product.supplier.name} (${product.supplier.code})` : null}
                />
                <div className="border-b border-slate-100 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Category</p>
                  <div className="mt-1">
                    <PaymentCategoryBadge category={product.payment_category} />
                  </div>
                </div>
              </div>
              <DetailRow label="Notes" value={product.notes} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductImagesEditor initialImages={product.product_images} productId={product.id} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Cost History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest Cost</p>
                  <p className="mt-1 text-2xl font-semibold text-[#0d1b34]">{formatRmb(latestCost?.unit_cost_rmb)}</p>
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
                    <TableHead>Supplier</TableHead>
                    <TableHead>Supplier Code</TableHead>
                    <TableHead className="text-right">Unit Cost (RMB)</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costHistoryRows.length ? (
                    costHistoryRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.quoted_date)}</TableCell>
                        <TableCell>{row.supplier ? `${row.supplier.name} (${row.supplier.code})` : "-"}</TableCell>
                        <TableCell>{row.supplier_product_code ?? "-"}</TableCell>
                        <TableCell className="text-right font-medium text-[#0d1b34]">
                          {formatRmb(row.unit_cost_rmb)}
                        </TableCell>
                        <TableCell>{row.source}</TableCell>
                        <TableCell>{row.notes ?? "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="text-slate-500" colSpan={6}>
                        No cost history yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {product.product_type === "set" ? (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Set Builder</CardTitle>
              </CardHeader>
              <CardContent>
                <SetComponentsEditor
                  availableProducts={availableProductOptions}
                  initialComponents={setComponents}
                  setProductId={product.id}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <StatusBadge status={product.status} />
                  <ProductStatusButton productId={product.id} status={product.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</p>
                <p className="mt-1 text-sm text-[#0d1b34]">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                  }).format(new Date(product.created_at))}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</p>
                <p className="mt-1 text-sm text-[#0d1b34]">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                  }).format(new Date(product.updated_at))}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
