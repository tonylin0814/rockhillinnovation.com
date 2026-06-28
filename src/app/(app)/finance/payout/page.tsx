import { redirect } from "next/navigation";

import { PayoutPage, type PayoutTrade } from "@/components/finance/PayoutPage";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PayoutInvoice } from "@/types";

export default async function FinancePayoutPage() {
  const user = await getCurrentUser();

  if (!user || !["admin", "controller", "manager"].includes(user.role)) {
    redirect("/dashboard");
  }

  const canEdit = user.role === "admin" || user.role === "controller";
  const supabase = createServerSupabaseClient();
  const { data: trades } = await supabase
    .from("trades")
    .select(
      `id,
      trade_id,
      trade_date,
      status,
      shareholders:trade_shareholders(
        id,
        person_name,
        split_pct,
        user_id
      ),
      book:shareholder_book(
        net_profit_usd,
        status,
        lines:shareholder_book_lines(
          id,
          trade_shareholder_id,
          person_name,
          split_pct,
          net_share_usd
        )
      )`
    )
    .order("trade_date", { ascending: false });

  const tradesWithShareholders = (trades ?? []).filter((trade) => {
    const shareholders = Array.isArray(trade.shareholders) ? trade.shareholders : [trade.shareholders];
    return shareholders.length > 0 && shareholders[0] != null;
  });
  const tradeIds = tradesWithShareholders.map((trade) => trade.id);
  const { data: payoutInvoices } = tradeIds.length
    ? await supabase.from("payout_invoices").select("*").in("trade_id", tradeIds)
    : { data: [] };

  return (
    <PayoutPage
      canEdit={canEdit}
      payoutInvoices={(payoutInvoices ?? []) as PayoutInvoice[]}
      trades={tradesWithShareholders as PayoutTrade[]}
    />
  );
}
