import { Suspense } from "react";

import { QuoteHistoryTable } from "@/components/history/QuoteHistoryTable";
import { T } from "@/components/i18n/T";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuotationHistory } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function QuoteHistoryPage() {
  const user = await getCurrentUser();

  if (!user || user.role === "partner" || user.role === "user") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">
            <T k="common.accessDenied" fallback="Access denied" />
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            <T k="history.accessDeniedHelp" fallback="History is not available to your account." />
          </p>
        </div>
      </div>
    );
  }

  const canManage = user.role === "admin";
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <T k="history.records" fallback="Records" />
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">
          <T k="history.quoteHistory" fallback="Quote History" />
        </h1>
      </div>

      <Suspense fallback={<div className="py-4 text-sm text-slate-500"><T k="common.loading" fallback="Loading..." /></div>}>
        <QuoteHistoryTable canManage={canManage} quoteRows={(quoteRows ?? []) as QuotationHistory[]} />
      </Suspense>
    </section>
  );
}
