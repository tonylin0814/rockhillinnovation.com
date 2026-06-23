"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

const tradeSchema = z.object({
  trade_id: z.string().trim().min(1, "Trade ID is required"),
  order_number: z.string().trim().nullable(),
  trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Trade date is required"),
  client_id: z.string().uuid("Client is required"),
  working_exchange_rate: z.coerce.number().positive("Working exchange rate must be positive").nullable(),
  corporate_tax_rate: z.coerce.number().min(0).max(1).default(0.12),
  notes: z.string().trim().nullable(),
  partner_ids: z.array(z.string().uuid()).default([]),
});

async function requireTradeManager() {
  const user = await getCurrentUser();

  if (!user || user.role === "partner") {
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

  revalidatePath("/trades");
  return { success: true, id: trade.id };
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
  return { success: true };
}
