import { ProductFormDialog, type ProductSupplierOption } from "@/components/products/ProductFormDialog";
import { ProductsTable } from "@/components/products/ProductsTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product } from "@/types";

export default async function ProductsPage() {
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
  const [{ data: products, error: productsError }, { data: suppliers, error: suppliersError }] = await Promise.all([
    supabase
      .from("products")
      .select("*, supplier:suppliers(id, name, code), components:product_components(id)")
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

  const allProducts = (products ?? []) as Product[];
  const partProducts = allProducts.filter((product) => product.product_type === "part");
  const setProducts = allProducts.filter((product) => product.product_type === "set");
  const supplierOptions = (suppliers ?? []) as ProductSupplierOption[];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Catalog</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">Products</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ProductFormDialog defaultProductType="part" mode="create" suppliers={supplierOptions} />
          <ProductFormDialog
            defaultProductType="set"
            mode="create"
            suppliers={supplierOptions}
            trigger={
              <Button variant="outline">
                Add Set
              </Button>
            }
          />
        </div>
      </div>

      <Tabs className="space-y-4" defaultValue="parts">
        <TabsList>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="sets">Sets</TabsTrigger>
        </TabsList>

        <TabsContent value="parts">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Part Products</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductsTable mode="parts" products={partProducts} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sets">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Set Products</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductsTable mode="sets" products={setProducts} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
