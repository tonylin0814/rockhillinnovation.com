import { Suspense } from "react";

import { QuoteHistoryTable } from "@/components/history/QuoteHistoryTable";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function QuoteHistoryPage() {
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
  const [{ data: quoteRows, error: quoteError }, { data: products, error: productsError }] = await Promise.all([
    supabase
      .from("client_quotation_lines")
      .select(
        "*, product:products(id, code, supplier_product_code, name_english, name_chinese), session:client_quotation_sessions!inner(id, session_number, quote_date, status, trade:trades(id, trade_id), client:clients(id, code, name))"
      )
      .eq("session.status", "accepted")
      .limit(500),
    supabase
      .from("products")
      .select("id, code, supplier_product_code, name_english, name_chinese")
      .order("code", { ascending: true }),
  ]);

  if (quoteError || productsError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {quoteError?.message ?? productsError?.message}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Records</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">Quote History</h1>
      </div>

      <Suspense fallback={<div className="py-4 text-sm text-slate-500">Loading...</div>}>
        <QuoteHistoryTable
          products={products ?? []}
          quoteRows={(quoteRows ?? []).map((row) => {
            const session = firstJoin(row.session);

            return {
              ...row,
              product: firstJoin(row.product),
              session: session
                ? {
                    ...session,
                    client: firstJoin(session.client),
                    trade: firstJoin(session.trade),
                  }
                : null,
            };
          })}
        />
      </Suspense>
    </section>
  );
}
