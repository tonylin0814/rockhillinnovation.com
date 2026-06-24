"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MilestoneKey } from "@/types";

const MILESTONE_KEYS: MilestoneKey[] = [
  "deposit_received",
  "deposit_sent",
  "goods_shipped",
  "balance_received",
  "balance_sent",
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
      milestone: z.enum(["deposit_received", "deposit_sent", "goods_shipped", "balance_received", "balance_sent"]),
      notes: z.string().trim().nullable().optional(),
      tradeId: z.string().uuid(),
    })
    .safeParse({ milestone, notes, tradeId });

  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("trade_milestones").upsert(
    {
      completed_at: new Date().toISOString(),
      completed_by: access.user.id,
      milestone: parsed.data.milestone,
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
      milestone: z.enum(["deposit_received", "deposit_sent", "goods_shipped", "balance_received", "balance_sent"]),
      tradeId: z.string().uuid(),
    })
    .safeParse({ milestone, tradeId });

  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("trade_milestones")
    .update({ completed_at: null, completed_by: null, notes: null })
    .eq("trade_id", parsed.data.tradeId)
    .eq("milestone", parsed.data.milestone);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}
