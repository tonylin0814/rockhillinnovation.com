import { NewTradeDialog, type TradeClientOption, type TradePartnerOption } from "@/components/trades/NewTradeDialog";
import { TradesTable } from "@/components/trades/TradesTable";
import { T } from "@/components/i18n/T";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trade } from "@/types";

export default async function TradesPage() {
  const user = await getCurrentUser();
  const supabase = createServerSupabaseClient();
  const canCreateTrades = user?.role === "admin" || user?.role === "manager";
  const isUserRole = user?.role === "user";
  let grantedClientIds: string[] = [];

  if (isUserRole && user) {
    const { data: grants, error: grantsError } = await supabase
      .from("user_client_access")
      .select("client_id")
      .eq("user_id", user.id);

    if (grantsError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {grantsError.message}
        </div>
      );
    }

    grantedClientIds = (grants ?? []).map((grant) => grant.client_id);
  }

  const tradesQuery = supabase
    .from("trades")
    .select("*, client:clients(id, name, code)")
    .order("trade_date", { ascending: false });

  const [{ data: trades, error: tradesError }, { data: clients, error: clientsError }, { data: partners, error: partnersError }] =
    await Promise.all([
      isUserRole && !grantedClientIds.length ? Promise.resolve({ data: [], error: null }) : isUserRole ? tradesQuery.in("client_id", grantedClientIds) : tradesQuery,
      canCreateTrades
        ? supabase.from("clients").select("id, name, code").eq("status", "active").order("name", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      canCreateTrades
        ? supabase
            .from("users")
            .select("id, name, email")
            .in("role", ["partner", "manager"])
            .eq("is_active", true)
            .order("name", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (tradesError || clientsError || partnersError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {tradesError?.message ?? clientsError?.message ?? partnersError?.message}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <T k="trades.operations" fallback="Operations" />
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">
            <T k="trades.title" fallback="Trades" />
          </h1>
        </div>
        {canCreateTrades ? (
          <NewTradeDialog
            clients={(clients ?? []) as TradeClientOption[]}
            partners={(partners ?? []) as TradePartnerOption[]}
          />
        ) : null}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>
            <T k="trades.tradeList" fallback="Trade List" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TradesTable trades={(trades ?? []) as Trade[]} />
        </CardContent>
      </Card>
    </section>
  );
}
