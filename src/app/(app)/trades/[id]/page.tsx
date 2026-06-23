import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trade } from "@/types";

const statusClasses: Record<Trade["status"], string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  active: "border-blue-200 bg-blue-50 text-blue-700",
  settled: "border-green-200 bg-green-50 text-green-700",
  archived: "border-red-200 bg-red-50 text-red-700",
};

export default async function TradeDetailPlaceholderPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*, client:clients(id, name, code)")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error.message}
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const trade = data as Trade;

  return (
    <section className="space-y-6">
      <div>
        <Link className="text-sm font-medium text-slate-500 transition-colors hover:text-[#0d1b34]" href="/trades">
          Back to Trades
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-3xl font-semibold text-[#0d1b34]">{trade.trade_id}</h1>
          <Badge className={statusClasses[trade.status]} variant="outline">
            {trade.status}
          </Badge>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Trade Detail</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">Trade detail workspace coming next.</CardContent>
      </Card>
    </section>
  );
}
