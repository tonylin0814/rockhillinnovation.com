import { T } from "@/components/i18n/T";
import { ProductFormDialog, type ProductSupplierOption } from "@/components/products/ProductFormDialog";
import { ProductsTable } from "@/components/products/ProductsTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product } from "@/types";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">
            <T k="common.accessDenied" fallback="Access denied" />
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            <T k="products.accessDeniedHelp" fallback="Products are available to signed-in users only." />
          </p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const [{ data: products, error: productsError }, { data: suppliers, error: suppliersError }] = await Promise.all([
    supabase
      .from("products")
      .select("*, supplier:suppliers(id, name, code), components:product_components!product_components_set_product_id_fkey(id)")
      .order("code", { ascending: true }),
    supabase.from("suppliers").select("id, name, code").eq("status", "active").order("name", { ascending: true }),
  ]);

  if (productsError || suppliersError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {productsError?.message ?? suppliersError?.message}
      </div>
    );
  }

  const canManage = user.role === "admin" || user.role === "manager";
  const isPartner = user.role === "partner";
  const allProducts = ((products ?? []) as Product[]).filter((product) =>
    isPartner ? product.code.toUpperCase().startsWith("MLP-") : true
  );
  const activeProducts = allProducts.filter((product) => product.status === "active");
  const standardProducts = activeProducts.filter((product) => product.product_type === "part");
  const setProducts = activeProducts.filter((product) => product.product_type === "set");
  const inactiveProducts = allProducts.filter((product) => product.status === "inactive");
  const supplierOptions = canManage ? ((suppliers ?? []) as ProductSupplierOption[]) : [];
  const activeTab = ["products", "sets", "inactive"].includes(searchParams?.tab ?? "")
    ? searchParams?.tab
    : "products";

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <T k="products.catalog" fallback="Catalog" />
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">
            <T k="products.title" fallback="Products" />
          </h1>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ProductFormDialog defaultProductType="part" mode="create" suppliers={supplierOptions} />
            <ProductFormDialog
              availableProducts={standardProducts}
              defaultProductType="set"
              mode="create"
              suppliers={supplierOptions}
              trigger={<Button variant="outline"><T k="products.addSet" fallback="Add Set" /></Button>}
            />
          </div>
        ) : null}
      </div>

      <Tabs className="space-y-4" defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger asChild value="products">
            <a href="/products?tab=products"><T k="products.products" fallback="Products" /></a>
          </TabsTrigger>
          <TabsTrigger asChild value="sets">
            <a href="/products?tab=sets"><T k="products.sets" fallback="Sets" /></a>
          </TabsTrigger>
          <TabsTrigger asChild value="inactive">
            <a href="/products?tab=inactive"><T k="products.inactiveItems" fallback="Inactive Items" /></a>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle><T k="products.products" fallback="Products" /></CardTitle>
            </CardHeader>
            <CardContent>
              <ProductsTable backHref="/products?tab=products" mode="products" products={standardProducts} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sets">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle><T k="products.setProducts" fallback="Set Products" /></CardTitle>
            </CardHeader>
            <CardContent>
              <ProductsTable backHref="/products?tab=sets" mode="sets" products={setProducts} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle><T k="products.inactiveItems" fallback="Inactive Items" /></CardTitle>
            </CardHeader>
            <CardContent>
              <ProductsTable backHref="/products?tab=inactive" mode="inactive" products={inactiveProducts} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
