"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = { success?: true; error?: string };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function requireManager() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (user.role === "partner") {
    return { error: "Managers and admins only" };
  }

  return { user };
}

export async function calculateShareholderBook(tradeId: string): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  if (!z.string().uuid().safeParse(tradeId).success) {
    return { error: "Invalid trade" };
  }

  const supabase = createServerSupabaseClient();

  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id, corporate_tax_rate")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const taxRate = Number(trade.corporate_tax_rate ?? 0);

  const { data: shareholders, error: shareholdersError } = await supabase
    .from("trade_shareholders")
    .select("id, person_name, split_pct, invoices_through_entity, expense_vendor:expense_vendors(id, name)")
    .eq("trade_id", tradeId)
    .order("person_name", { ascending: true });

  if (shareholdersError) {
    return { error: shareholdersError.message };
  }

  if (!shareholders?.length) {
    return { error: "No profit split rules configured. Add shareholders first." };
  }

  const totalSplit = shareholders.reduce((sum, shareholder) => sum + Number(shareholder.split_pct), 0);

  if (Math.abs(totalSplit - 100) > 0.01) {
    return { error: `Profit split must sum to 100% (currently ${totalSplit.toFixed(2)}%)` };
  }

  const { data: paidInvoices, error: invoicesError } = await supabase
    .from("client_invoices")
    .select("total_usd")
    .eq("trade_id", tradeId)
    .eq("status", "paid");

  if (invoicesError) {
    return { error: invoicesError.message };
  }

  const grossRevenue = roundMoney(
    (paidInvoices ?? []).reduce((sum, invoice) => sum + Number(invoice.total_usd ?? 0), 0)
  );

  const { data: demand, error: demandError } = await supabase
    .from("component_demand")
    .select("estimated_cost_usd")
    .eq("trade_id", tradeId);

  if (demandError) {
    return { error: demandError.message };
  }

  const supplierCosts = roundMoney((demand ?? []).reduce((sum, item) => sum + Number(item.estimated_cost_usd ?? 0), 0));

  const { data: vendorInvoices, error: vendorError } = await supabase
    .from("expense_vendor_invoices")
    .select("amount_usd")
    .eq("trade_id", tradeId);

  if (vendorError) {
    return { error: vendorError.message };
  }

  const expenseDeductions = roundMoney(
    (vendorInvoices ?? []).reduce((sum, invoice) => sum + Number(invoice.amount_usd ?? 0), 0)
  );

  const grossProfit = roundMoney(grossRevenue - supplierCosts);
  const taxableBase = roundMoney(grossProfit - expenseDeductions);
  const corporateTax = roundMoney(taxableBase * taxRate);
  const netProfit = roundMoney(taxableBase - corporateTax);
  const perShare = roundMoney(netProfit / 100);

  const { error: deleteError } = await supabase.from("shareholder_book").delete().eq("trade_id", tradeId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const { data: book, error: bookError } = await supabase
    .from("shareholder_book")
    .insert({
      calculated_at: new Date().toISOString(),
      corporate_tax_rate: taxRate,
      corporate_tax_usd: corporateTax,
      expense_deductions_usd: expenseDeductions,
      gross_profit_usd: grossProfit,
      net_profit_usd: netProfit,
      per_share_usd: perShare,
      status: "draft",
      taxable_base_usd: taxableBase,
      trade_id: tradeId,
    })
    .select("id")
    .single();

  if (bookError) {
    return { error: bookError.message };
  }

  const lines = shareholders.map((shareholder) => {
    const splitPct = Number(shareholder.split_pct);
    const grossShare = roundMoney(taxableBase * (splitPct / 100));
    const taxContribution = roundMoney(grossShare * taxRate);
    const netShare = roundMoney(grossShare - taxContribution);
    const vendor = Array.isArray(shareholder.expense_vendor)
      ? shareholder.expense_vendor[0]
      : shareholder.expense_vendor;
    const invoicedThrough = shareholder.invoices_through_entity && vendor?.name ? vendor.name : null;

    return {
      book_id: book.id,
      gross_share_usd: grossShare,
      invoiced_through: invoicedThrough,
      net_share_usd: netShare,
      person_name: shareholder.person_name,
      split_pct: splitPct,
      tax_contribution_usd: taxContribution,
      trade_shareholder_id: shareholder.id,
    };
  });

  const { error: linesError } = await supabase.from("shareholder_book_lines").insert(lines);

  if (linesError) {
    return { error: linesError.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function confirmShareholderBook(bookId: string, tradeId: string): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({ bookId: z.string().uuid(), tradeId: z.string().uuid() })
    .safeParse({ bookId, tradeId });

  if (!parsed.success) {
    return { error: "Invalid IDs" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("shareholder_book")
    .update({ status: "confirmed" })
    .eq("id", parsed.data.bookId)
    .eq("trade_id", parsed.data.tradeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}
