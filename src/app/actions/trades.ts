"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { seedTradeMilestones } from "@/app/actions/trade-milestones";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

type ShareholderInput = {
  id?: string;
  person_name: string;
  split_pct: number;
  invoices_through_entity: boolean;
  expense_vendor_id: string | null;
};

const tradeFieldsSchema = z.object({
  trade_id: z.string().trim().min(1, "Trade ID is required"),
  order_number: z.string().trim().nullable(),
  trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Trade date is required"),
  client_id: z.string().uuid("Client is required"),
  working_exchange_rate: z.coerce.number().positive("Working exchange rate must be positive").nullable(),
  corporate_tax_rate: z.coerce.number().min(0).max(1).default(0.12),
  notes: z.string().trim().nullable(),
});

const tradeSchema = tradeFieldsSchema.extend({
  partner_ids: z.array(z.string().uuid()).default([]),
});

const shareholderInputSchema = z.object({
  id: z.string().uuid().optional(),
  person_name: z.string().trim().min(1, "Person name is required"),
  split_pct: z.coerce.number().positive("Split percentage must be greater than 0").max(100),
  invoices_through_entity: z.boolean(),
  expense_vendor_id: z.string().uuid().nullable(),
});

async function requireTradeManager() {
  const user = await getCurrentUser();

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return { error: "Access denied" };
  }

  return { user };
}

function emptyToNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function numberOrNull(value: FormDataEntryValue | null) {
  const normalized = emptyToNull(value);
  return normalized === null ? null : normalized;
}

function valuesFromForm(formData: FormData) {
  const taxPercent = Number(formData.get("corporate_tax_rate") || 12);

  return {
    trade_id: formData.get("trade_id"),
    order_number: emptyToNull(formData.get("order_number")),
    trade_date: formData.get("trade_date"),
    client_id: formData.get("client_id"),
    working_exchange_rate: numberOrNull(formData.get("working_exchange_rate")),
    corporate_tax_rate: Number.isFinite(taxPercent) ? taxPercent / 100 : 0.12,
    notes: emptyToNull(formData.get("notes")),
    partner_ids: formData.getAll("partner_ids"),
  };
}

export async function createTrade(formData: FormData): Promise<ActionResult> {
  const access = await requireTradeManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = tradeSchema.safeParse(valuesFromForm(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid trade details" };
  }

  const { partner_ids: partnerIds, ...tradeValues } = parsed.data;
  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase.from("trades").insert(tradeValues).select("id").single();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (partnerIds.length) {
    const participantRows = partnerIds.map((partnerId) => ({
      trade_id: trade.id,
      user_id: partnerId,
      added_by: access.user.id,
    }));

    const { error: participantsError } = await supabase.from("trade_participants").insert(participantRows);

    if (participantsError) {
      return { error: participantsError.message };
    }
  }

  await seedTradeMilestones(trade.id);

  revalidatePath("/trades");
  await logActivity({
    action: "created",
    summary: `Created trade ${tradeValues.trade_id}`,
    targetId: trade.id,
    targetTable: "trades",
    tradeId: trade.id,
    user: access.user,
  });
  return { success: true, id: trade.id };
}

export async function updateTrade(id: string, formData: FormData): Promise<ActionResult> {
  const access = await requireTradeManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid trade ID" };
  }

  const parsed = tradeFieldsSchema.safeParse(valuesFromForm(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid trade details" };
  }

  const supabase = createServerSupabaseClient();
  const { data: existingTrade, error: fetchError } = await supabase
    .from("trades")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!existingTrade) {
    return { error: "Trade not found" };
  }

  const { error } = await supabase.from("trades").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/trades");
  revalidatePath(`/trades/${id}`);
  await logActivity({
    action: "updated",
    summary: `Updated trade ${parsed.data.trade_id}`,
    targetId: id,
    targetTable: "trades",
    tradeId: id,
    user: access.user,
  });
  return { success: true };
}

export async function setTradeStatus(
  id: string,
  status: "draft" | "active" | "settled" | "archived"
): Promise<ActionResult> {
  const access = await requireTradeManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["draft", "active", "settled", "archived"]),
    })
    .safeParse({ id, status });

  if (!parsed.success) {
    return { error: "Invalid trade status update" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("trades").update({ status }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/trades");
  revalidatePath(`/trades/${id}`);
  await logActivity({
    action: "updated",
    summary: `Set trade status to ${status}`,
    targetId: id,
    targetTable: "trades",
    tradeId: id,
    user: access.user,
  });
  return { success: true };
}

export async function updateTradeParticipants(tradeId: string, partnerIds: string[]): Promise<ActionResult> {
  const access = await requireTradeManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      tradeId: z.string().uuid(),
      partnerIds: z.array(z.string().uuid()),
    })
    .safeParse({ tradeId, partnerIds });

  if (!parsed.success) {
    return { error: "Invalid partner assignment" };
  }

  const supabase = createServerSupabaseClient();
  const { error: deleteError } = await supabase
    .from("trade_participants")
    .delete()
    .eq("trade_id", tradeId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (parsed.data.partnerIds.length) {
    const rows = parsed.data.partnerIds.map((partnerId) => ({
      trade_id: tradeId,
      user_id: partnerId,
      added_by: access.user.id,
    }));

    const { error: insertError } = await supabase.from("trade_participants").insert(rows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function saveTradeShareholders(
  tradeId: string,
  shareholders: ShareholderInput[]
): Promise<ActionResult> {
  const access = await requireTradeManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      tradeId: z.string().uuid(),
      shareholders: z.array(shareholderInputSchema),
    })
    .safeParse({ tradeId, shareholders });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid shareholder rules" };
  }

  const totalSplit = parsed.data.shareholders.reduce((total, shareholder) => total + shareholder.split_pct, 0);

  if (Math.abs(totalSplit - 100) > 0.01) {
    return { error: "Split percentages must sum to 100%" };
  }

  const supabase = createServerSupabaseClient();
  const { error: deleteError } = await supabase.from("trade_shareholders").delete().eq("trade_id", tradeId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (parsed.data.shareholders.length) {
    const rows = parsed.data.shareholders.map((shareholder) => ({
      trade_id: tradeId,
      person_name: shareholder.person_name,
      split_pct: shareholder.split_pct,
      invoices_through_entity: shareholder.invoices_through_entity,
      expense_vendor_id: shareholder.invoices_through_entity ? shareholder.expense_vendor_id : null,
    }));

    const { error: insertError } = await supabase.from("trade_shareholders").insert(rows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}
