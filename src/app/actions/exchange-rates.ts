"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = { success?: true; error?: string };

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const rateSchema = z.object({
  tradeId: z.string().uuid(),
  payment_type: z.enum(["deposit", "final"]),
  rate_rmb_per_usd: z.coerce
    .number({ invalid_type_error: "Rate must be a number" })
    .positive("Rate must be greater than zero"),
  rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  reference_rate: z.coerce.number().positive().nullable().catch(null),
  notes: z.string().trim().nullable(),
});

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

export async function saveExchangeRate(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = rateSchema.safeParse({
    tradeId,
    payment_type: formData.get("payment_type"),
    rate_rmb_per_usd: formData.get("rate_rmb_per_usd"),
    rate_date: formData.get("rate_date"),
    reference_rate: emptyToNull(formData.get("reference_rate")),
    notes: emptyToNull(formData.get("notes")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid rate data" };
  }

  const supabase = createServerSupabaseClient();

  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id")
    .eq("id", parsed.data.tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const { error } = await supabase.from("exchange_rates").upsert(
    {
      notes: parsed.data.notes,
      payment_type: parsed.data.payment_type,
      rate_date: parsed.data.rate_date,
      rate_rmb_per_usd: parsed.data.rate_rmb_per_usd,
      reference_rate: parsed.data.reference_rate,
      trade_id: parsed.data.tradeId,
    },
    { onConflict: "trade_id,payment_type" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}
