"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MilestoneKey } from "@/types";

const MILESTONE_KEYS: MilestoneKey[] = [
  "dev_sample_design",
  "dev_sample_shipping",
  "dev_first_estimate",
  "dev_product_accepted",
  "inquiry_received",
  "quote_received",
  "quotation_sent",
  "deposit_invoice_sent",
  "deposit_received",
  "deposit_sent",
  "production_ongoing",
  "packing_strategy",
  "final_invoice_sent",
  "final_payment_received",
  "qc_arrangement",
  "qc_complete",
  "freight_arrangement",
  "final_supplier_invoice",
  "freight_starts",
  "vendor_payment",
  "client_received",
  "feedback",
  "accounting",
];

export type ActionResult = { success?: true; error?: string };

async function requireManager() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (user.role === "partner" || user.role === "user") {
    return { error: "Managers and admins only" };
  }

  return { user };
}

export async function seedTradeMilestones(tradeId: string): Promise<void> {
  const tradeIdParsed = z.string().uuid().safeParse(tradeId);

  if (!tradeIdParsed.success) {
    return;
  }

  const supabase = createServerSupabaseClient();
  const rows = MILESTONE_KEYS.map((milestone) => ({
    completed_at: null,
    completed_by: null,
    milestone,
    notes: null,
    trade_id: tradeId,
  }));

  await supabase.from("trade_milestones").upsert(rows, { onConflict: "trade_id,milestone" });
}

export async function completeMilestone(
  tradeId: string,
  milestone: MilestoneKey,
  notes?: string
): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      milestone: z.string().min(1),
      notes: z.string().trim().nullable().optional(),
      tradeId: z.string().uuid(),
    })
    .safeParse({ milestone, notes, tradeId });

  if (!parsed.success || !MILESTONE_KEYS.includes(parsed.data.milestone as MilestoneKey)) {
    return { error: "Invalid input" };
  }

  const milestoneKey = parsed.data.milestone as MilestoneKey;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("trade_milestones").upsert(
    {
      completed_at: new Date().toISOString(),
      completed_by: access.user.name,
      milestone: milestoneKey,
      notes: parsed.data.notes ?? null,
      trade_id: parsed.data.tradeId,
    },
    { onConflict: "trade_id,milestone" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function uncompleteMilestone(tradeId: string, milestone: MilestoneKey): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      milestone: z.string().min(1),
      tradeId: z.string().uuid(),
    })
    .safeParse({ milestone, tradeId });

  if (!parsed.success || !MILESTONE_KEYS.includes(parsed.data.milestone as MilestoneKey)) {
    return { error: "Invalid input" };
  }

  const milestoneKey = parsed.data.milestone as MilestoneKey;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("trade_milestones")
    .update({ completed_at: null, completed_by: null, notes: null })
    .eq("trade_id", parsed.data.tradeId)
    .eq("milestone", milestoneKey);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}
