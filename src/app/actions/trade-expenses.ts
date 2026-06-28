"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = { success?: true; error?: string };

async function requireManager() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return { error: "Access denied" };
  }

  return { user };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const expenseSchema = z.object({
  amount_usd: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.enum(["bank_fee", "reimbursement_tony", "reimbursement_michael", "shipping", "duty", "misc"]),
  description: z.string().trim().min(1, "Description is required"),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  notes: z.string().trim().nullable(),
});

function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    amount_usd: formData.get("amount_usd"),
    category: formData.get("category") ?? "misc",
    description: emptyToNull(formData.get("description")),
    expense_date: formData.get("expense_date"),
    notes: emptyToNull(formData.get("notes")),
  });
}

export async function addTradeExpense(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  if (!z.string().uuid().safeParse(tradeId).success) {
    return { error: "Invalid trade" };
  }

  const parsed = parseExpenseForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("trade_expenses").insert({
    ...parsed.data,
    created_by: access.user.id,
    trade_id: tradeId,
  }).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  await logActivity({
    action: "created",
    summary: `Added trade expense: ${parsed.data.description}`,
    targetId: data.id,
    targetTable: "trade_expenses",
    tradeId,
    user: access.user,
  });
  return { success: true };
}

export async function updateTradeExpense(id: string, tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Invalid ID" };
  }

  const parsed = parseExpenseForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("trade_expenses").update(parsed.data).eq("id", id).eq("trade_id", tradeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  await logActivity({
    action: "updated",
    summary: `Updated trade expense: ${parsed.data.description}`,
    targetId: id,
    targetTable: "trade_expenses",
    tradeId,
    user: access.user,
  });
  return { success: true };
}

export async function deleteTradeExpense(id: string, tradeId: string): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Invalid ID" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("trade_expenses").delete().eq("id", id).eq("trade_id", tradeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  await logActivity({
    action: "deleted",
    summary: "Deleted trade expense",
    targetId: id,
    targetTable: "trade_expenses",
    tradeId,
    user: access.user,
  });
  return { success: true };
}
