import { Suspense } from "react";

import { CostHistoryTable } from "@/components/history/CostHistoryTable";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function CostHistoryPage() {
  const user = await getCurrentUser();

  if (!user || user.role === "user") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">History is not available to your account.</p>
        </div>
      </div>
    );
  }

  const isPartner = user.role === "partner";
  const supabase = createServerSupabaseClient();
  const productQuery = supabase
    .from("products")
    .select("id, code, supplier_product_code, name_english, name_chinese")
    .order("code", { ascending: true });

  if (isPartner) {
    productQuery.ilike("code", "MLP-%");
  }

  const { data: products, error: productsError } = await productQuery;
  const productIds = (products ?? []).map((product) => product.id);

  const costQuery = supabase
    .from("product_cost_history")
    .select(
      "*, product:products(id, code, supplier_product_code, name_english, name_chinese), supplier:suppliers(id, code, name)"
    )
    .order("quoted_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (isPartner) {
    costQuery.in("product_id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const [{ data: costRows, error: costError }, { data: suppliers, error: suppliersError }] = await Promise.all([
    costQuery,
    isPartner
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("suppliers").select("id, code, name").order("code", { ascending: true }),
  ]);

  if (costError || productsError || suppliersError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {costError?.message ?? productsError?.message ?? suppliersError?.message}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Records</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">Cost History</h1>
      </div>

      <Suspense fallback={<div className="py-4 text-sm text-slate-500">Loading...</div>}>
        <CostHistoryTable
          costRows={(costRows ?? []).map((row) => ({
            ...row,
            product: firstJoin(row.product),
            supplier: firstJoin(row.supplier),
          }))}
          products={products ?? []}
          suppliers={suppliers ?? []}
          canManage={!isPartner}
        />
      </Suspense>
    </section>
  );
}
