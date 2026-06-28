"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager as requireManagerRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = { success?: true; error?: string };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function requireManager() {
  const access = await requireManagerRole();

  if ("error" in access) {
    return { error: access.error };
  }

  return access;
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
    .select("id, corporate_tax_rate, working_exchange_rate")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

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

  const { data: clientInvoices, error: invoicesError } = await supabase
    .from("client_invoices")
    .select("total_usd")
    .eq("trade_id", tradeId);

  if (invoicesError) {
    return { error: invoicesError.message };
  }

  const grossRevenue = roundMoney(
    (clientInvoices ?? []).reduce((sum, invoice) => sum + Number(invoice.total_usd ?? 0), 0)
  );

  const exchangeRate = Number(trade.working_exchange_rate ?? 0);
  const { data: supplierInvoices, error: supplierInvoicesError } = await supabase
    .from("supplier_invoices_outgoing")
    .select("total_usd, total_rmb")
    .eq("trade_id", tradeId);

  if (supplierInvoicesError) {
    return { error: supplierInvoicesError.message };
  }

  const supplierCosts = roundMoney(
    (supplierInvoices ?? []).reduce((sum, invoice) => {
      if (invoice.total_usd != null) {
        return sum + Number(invoice.total_usd);
      }

      if (exchangeRate > 0 && invoice.total_rmb != null) {
        return sum + Number(invoice.total_rmb) / exchangeRate;
      }

      return sum;
    }, 0)
  );

  const { data: vendorInvoices, error: vendorError } = await supabase
    .from("expense_vendor_invoices")
    .select("amount_usd")
    .eq("trade_id", tradeId);

  if (vendorError) {
    return { error: vendorError.message };
  }

  const { data: tradeExpenses, error: tradeExpensesError } = await supabase
    .from("trade_expenses")
    .select("amount_usd, category")
    .eq("trade_id", tradeId);

  if (tradeExpensesError) {
    return { error: tradeExpensesError.message };
  }

  const reimbursementByPerson = (tradeExpenses ?? []).reduce<Record<string, number>>((acc, expense) => {
    if (expense.category === "reimbursement_tony") {
      acc.tony = (acc.tony ?? 0) + Number(expense.amount_usd ?? 0);
    }

    if (expense.category === "reimbursement_michael") {
      acc.michael = (acc.michael ?? 0) + Number(expense.amount_usd ?? 0);
    }

    if (expense.category === "reimbursement_amish") {
      acc.amish = (acc.amish ?? 0) + Number(expense.amount_usd ?? 0);
    }

    return acc;
  }, {});

  const expenseDeductions = roundMoney(
    (vendorInvoices ?? []).reduce((sum, invoice) => sum + Number(invoice.amount_usd ?? 0), 0) +
      (tradeExpenses ?? []).reduce((sum, expense) => {
        if (
          expense.category === "reimbursement_tony" ||
          expense.category === "reimbursement_michael" ||
          expense.category === "reimbursement_amish"
        ) {
          return sum;
        }

        return sum + Number(expense.amount_usd ?? 0);
      }, 0)
  );

  const taxRate = shareholders.length === 1 ? 0 : Number(trade.corporate_tax_rate ?? 0);
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
    const normalizedName = shareholder.person_name.trim().toLowerCase();
    const reimbursement =
      normalizedName.includes("tony")
        ? (reimbursementByPerson.tony ?? 0)
        : normalizedName.includes("michael")
          ? (reimbursementByPerson.michael ?? 0)
          : normalizedName.includes("amish")
            ? (reimbursementByPerson.amish ?? 0)
            : 0;
    const netShare = roundMoney(grossShare - taxContribution + reimbursement);
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
