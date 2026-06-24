"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = { success?: true; error?: string };

async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (user.role !== "admin") {
    return { error: "Admins only" };
  }

  return { user };
}

const payoutSchema = z.object({
  amountUsd: z.coerce.number().positive("Amount must be positive"),
  notes: z.string().trim().nullable().optional(),
  personName: z.string().trim().min(1, "Person name required"),
  reference: z.string().trim().nullable().optional(),
  tradeId: z.string().uuid(),
  wireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
});

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function addShareholderPayout(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = payoutSchema.safeParse({
    amountUsd: formData.get("amount_usd"),
    notes: emptyToNull(formData.get("notes")),
    personName: formData.get("person_name"),
    reference: emptyToNull(formData.get("reference")),
    tradeId,
    wireDate: formData.get("wire_date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("shareholder_payouts").insert({
    amount_usd: parsed.data.amountUsd,
    created_by: access.user.id,
    notes: parsed.data.notes ?? null,
    person_name: parsed.data.personName,
    reference: parsed.data.reference ?? null,
    trade_id: parsed.data.tradeId,
    wire_date: parsed.data.wireDate,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/finance");
  return { success: true };
}

export async function deleteShareholderPayout(id: string): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.string().uuid().safeParse(id);

  if (!parsed.success) {
    return { error: "Invalid ID" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("shareholder_payouts").delete().eq("id", parsed.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/finance");
  return { success: true };
}
