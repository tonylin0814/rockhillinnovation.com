import { redirect } from "next/navigation";

import { DashboardContent, type DashboardTradeRow } from "@/components/dashboard/DashboardContent";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(rows: Array<Record<string, unknown>>, field: string) {
  return roundMoney((rows ?? []).reduce((acc, row) => acc + Number(row[field] ?? 0), 0));
}

type TradeStatus = "draft" | "active" | "settled" | "archived";

type TradeRow = {
  id: string;
  trade_id: string;
  trade_date: string | null;
  status: TradeStatus;
  client?: { name: string | null } | { name: string | null }[] | null;
};

function ErrorMessage({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{message}</div>;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "user") {
    redirect("/trades");
  }

  const supabase = createServerSupabaseClient();
  const isYearFilter = (searchParams.period ?? "year") !== "all";
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const { data: participantRows, error: participantError } = await supabase
    .from("trade_participants")
    .select("trade_id")
    .eq("user_id", user.id);

  if (participantError) {
    return <ErrorMessage message={participantError.message} />;
  }

  const allTradeIds = (participantRows ?? []).map((row) => row.trade_id);
  let tradeIds = allTradeIds;

  if (isYearFilter && allTradeIds.length) {
    const { data: yearTrades, error: yearTradesError } = await supabase
      .from("trades")
      .select("id")
      .in("id", allTradeIds)
      .gte("trade_date", yearStart);

    if (yearTradesError) {
      return <ErrorMessage message={yearTradesError.message} />;
    }

    tradeIds = (yearTrades ?? []).map((trade) => trade.id);
  }

  let tradeRows: TradeRow[] = [];
  let clientInvoices: Array<Record<string, unknown>> = [];
  let supplierInvoices: Array<Record<string, unknown>> = [];
  let vendorInvoices: Array<Record<string, unknown>> = [];
  let tradeExpenses: Array<Record<string, unknown>> = [];
  let confirmedBooks: Array<Record<string, unknown>> = [];
  let dividendLines: Array<Record<string, unknown>> = [];

  if (tradeIds.length) {
    const [
      tradeResult,
      clientInvoiceResult,
      supplierInvoiceResult,
      vendorInvoiceResult,
      tradeExpenseResult,
      confirmedBookResult,
    ] = await Promise.all([
      supabase
        .from("trades")
        .select("id, trade_id, trade_date, status, client:clients(name)")
        .in("id", tradeIds)
        .order("trade_date", { ascending: false }),
      supabase.from("client_invoices").select("total_usd").in("trade_id", tradeIds),
      supabase.from("supplier_invoices_outgoing").select("total_usd").in("trade_id", tradeIds),
      supabase.from("expense_vendor_invoices").select("amount_usd").in("trade_id", tradeIds),
      supabase.from("trade_expenses").select("amount_usd").in("trade_id", tradeIds),
      supabase.from("shareholder_book").select("id, net_profit_usd, corporate_tax_usd").in("trade_id", tradeIds).eq("status", "confirmed"),
    ]);

    const firstError =
      tradeResult.error ??
      clientInvoiceResult.error ??
      supplierInvoiceResult.error ??
      vendorInvoiceResult.error ??
      tradeExpenseResult.error ??
      confirmedBookResult.error;

    if (firstError) {
      return <ErrorMessage message={firstError.message} />;
    }

    tradeRows = (tradeResult.data ?? []) as TradeRow[];
    clientInvoices = (clientInvoiceResult.data ?? []) as Array<Record<string, unknown>>;
    supplierInvoices = (supplierInvoiceResult.data ?? []) as Array<Record<string, unknown>>;
    vendorInvoices = (vendorInvoiceResult.data ?? []) as Array<Record<string, unknown>>;
    tradeExpenses = (tradeExpenseResult.data ?? []) as Array<Record<string, unknown>>;
    confirmedBooks = (confirmedBookResult.data ?? []) as Array<Record<string, unknown>>;

    // Step 2: fetch dividend lines using confirmed book IDs and the shareholder user link.
    const confirmedBookIds = (confirmedBookResult.data ?? []).map((b) => (b as { id: string }).id).filter(Boolean);

    if (confirmedBookIds.length) {
      const { data: shareholderRows, error: shareholderError } = await supabase
        .from("trade_shareholders")
        .select("id")
        .eq("user_id", user.id)
        .in("trade_id", tradeIds);

      if (shareholderError) {
        return <ErrorMessage message={shareholderError.message} />;
      }

      const shareholderIds = (shareholderRows ?? []).map((row) => row.id).filter(Boolean);

      if (shareholderIds.length) {
        const { data: dividendData, error: dividendError } = await supabase
          .from("shareholder_book_lines")
          .select("net_share_usd")
          .in("book_id", confirmedBookIds)
          .in("trade_shareholder_id", shareholderIds);

        if (dividendError) {
          return <ErrorMessage message={dividendError.message} />;
        }

        dividendLines = (dividendData ?? []) as Array<Record<string, unknown>>;
      }
    }
  }

  const totalTrades = tradeIds.length;
  const totalSale = sum(clientInvoices, "total_usd");
  const supplierCost = sum(supplierInvoices, "total_usd");
  const vendorCost = sum(vendorInvoices, "amount_usd");
  const expenseCost = sum(tradeExpenses, "amount_usd");
  const corporateTax = roundMoney(
    confirmedBooks.reduce((acc, book) => acc + Number(book.corporate_tax_usd ?? 0), 0)
  );
  const totalCost = roundMoney(supplierCost + vendorCost + expenseCost + corporateTax);
  const totalProfit = sum(confirmedBooks, "net_profit_usd");
  const totalMargin = totalSale > 0 ? Math.round((totalProfit / totalSale) * 10000) / 100 : 0;
  const totalDividends = roundMoney(
    dividendLines.reduce((acc, row) => acc + Number(row.net_share_usd ?? 0), 0)
  );
  const dashboardTradeRows: DashboardTradeRow[] = tradeRows.map((trade) => {
    const client = Array.isArray(trade.client) ? trade.client[0] : trade.client;

    return {
      clientName: client?.name ?? null,
      id: trade.id,
      status: trade.status,
      trade_date: trade.trade_date,
      trade_id: trade.trade_id,
    };
  });

  return (
    <DashboardContent
      isYearFilter={isYearFilter}
      totalCost={totalCost}
      totalDividends={totalDividends}
      totalMargin={totalMargin}
      totalProfit={totalProfit}
      totalSale={totalSale}
      totalTrades={totalTrades}
      tradeRows={dashboardTradeRows}
      userName={user.name}
    />
  );
}
