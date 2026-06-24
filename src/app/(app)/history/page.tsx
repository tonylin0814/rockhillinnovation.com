import { Suspense } from "react";

import { HistoryTabs } from "@/components/history/HistoryTabs";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function HistoryPage() {
  const user = await getCurrentUser();

  if (user?.role === "partner") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">History is available to admins and managers only.</p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const [
    { data: costRows, error: costError },
    { data: quoteRows, error: quoteError },
    { data: products, error: productsError },
    { data: suppliers, error: suppliersError },
    { data: clients, error: clientsError },
  ] = await Promise.all([
    supabase
      .from("product_cost_history")
      .select("*, product:products(id, code, supplier_product_code, name_english, name_chinese), supplier:suppliers(id, code, name)")
      .order("quoted_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("product_quote_history")
      .select("*, product:products(id, code, supplier_product_code, name_english, name_chinese), client:clients(id, code, name)")
      .order("quoted_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("products")
      .select("id, code, supplier_product_code, name_english, name_chinese")
      .order("code", { ascending: true }),
    supabase.from("suppliers").select("id, code, name").order("code", { ascending: true }),
    supabase.from("clients").select("id, code, name").order("code", { ascending: true }),
  ]);

  if (costError || quoteError || productsError || suppliersError || clientsError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {costError?.message ?? quoteError?.message ?? productsError?.message ?? suppliersError?.message ?? clientsError?.message}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Records</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">History</h1>
      </div>

      <Suspense fallback={<div className="py-4 text-sm text-slate-500">Loading...</div>}>
        <HistoryTabs
          clients={clients ?? []}
          costRows={(costRows ?? []).map((row) => ({
            ...row,
            product: firstJoin(row.product),
            supplier: firstJoin(row.supplier),
          }))}
          products={products ?? []}
          quoteRows={(quoteRows ?? []).map((row) => {
            return {
              ...row,
              product: firstJoin(row.product),
              client: firstJoin(row.client),
            };
          })}
          suppliers={suppliers ?? []}
        />
      </Suspense>
    </section>
  );
}
