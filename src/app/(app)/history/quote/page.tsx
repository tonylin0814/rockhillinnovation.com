import { Suspense } from "react";

import { QuoteHistoryTable } from "@/components/history/QuoteHistoryTable";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuotationHistory } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const { data: quoteRows, error: quoteError } = await supabase
    .from("quotation_history")
    .select("*")
    .order("quote_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (quoteError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {quoteError.message}
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
        <QuoteHistoryTable quoteRows={(quoteRows ?? []) as QuotationHistory[]} />
      </Suspense>
    </section>
  );
}
