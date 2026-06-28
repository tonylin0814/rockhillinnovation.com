import { redirect } from "next/navigation";

import { CompanyFinancePage } from "@/components/finance/CompanyFinancePage";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ShareholderPayout } from "@/types";

export default async function FinancePage() {
  const user = await getCurrentUser();

  if (!user || !["admin", "controller", "manager"].includes(user.role)) {
    redirect("/dashboard");
  }

  const canEdit = user.role === "admin" || user.role === "controller";
  const supabase = createServerSupabaseClient();
  const [{ data: settledTrades }, { data: activeTrades }, { data: payouts }] = await Promise.all([
    supabase
      .from("trades")
      .select(
        `id,
        trade_id,
        trade_date,
        status,
        client:clients(id, name, code),
        book:shareholder_book(
          id,
          gross_profit_usd,
          expense_deductions_usd,
          taxable_base_usd,
          corporate_tax_rate,
          corporate_tax_usd,
          net_profit_usd,
          per_share_usd,
          status,
          calculated_at,
          lines:shareholder_book_lines(
            id,
            trade_shareholder_id,
            person_name,
            split_pct,
            net_share_usd,
            gross_share_usd,
            tax_contribution_usd
          )
        )`
      )
      .eq("status", "settled")
      .order("trade_date", { ascending: false }),
    supabase
      .from("trades")
      .select(
        `id,
        trade_id,
        trade_date,
        status,
        client:clients(id, name, code),
        client_invoices(total_usd, status),
        supplier_invoices_outgoing(total_usd, total_rmb),
        trade_expenses(amount_usd),
        book:shareholder_book(net_profit_usd, corporate_tax_usd, status)`
      )
      .in("status", ["active", "draft"])
      .order("trade_date", { ascending: false }),
    supabase.from("shareholder_payouts").select("*").order("wire_date", { ascending: false }),
  ]);

  return (
    <CompanyFinancePage
      activeTrades={activeTrades ?? []}
      canEdit={canEdit}
      payouts={(payouts ?? []) as ShareholderPayout[]}
      settledTrades={settledTrades ?? []}
    />
  );
}
