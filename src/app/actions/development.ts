"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type Result = { success?: true; id?: string; error?: string };

const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable()
);

const nullableAmount = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? Number(value) : null),
  z.number().nonnegative().nullable()
);

const nullableUuid = z.preprocess(
  (value) => (typeof value === "string" && value !== "none" ? value : null),
  z.string().uuid().nullable()
);

const versionSchema = z.object({
  trade_id: z.string().uuid(),
  product_id: nullableUuid,
  product_name_override: nullableText,
  version_label: z.string().trim().min(1, "Version label required"),
  change_summary: nullableText,
  file_onedrive_url: nullableText,
  status: z.enum(["draft", "sent_to_producer", "sample_received", "client_approved", "rejected", "in_correction"]),
  notes: nullableText,
});

const costSchema = z.object({
  trade_id: z.string().uuid(),
  version_id: nullableUuid,
  cost_type: z.enum(["molding", "sample", "express_shipping", "other"]),
  description: nullableText,
  amount_rmb: nullableAmount,
  amount_cad: nullableAmount,
  amount_usd: nullableAmount,
  is_absorbed: z.preprocess((value) => value === "true" || value === true, z.boolean()),
  notes: nullableText,
});

function revalidate(tradeId: string) {
  revalidatePath(`/trades/${tradeId}`);
}

export async function createDevelopmentVersion(formData: FormData): Promise<Result> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = versionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("trade_development_versions")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidate(parsed.data.trade_id);
  return { success: true, id: data.id };
}

export async function updateDevelopmentVersion(id: string, formData: FormData): Promise<Result> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid ID" };
  }

  const parsed = versionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("trade_development_versions").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidate(parsed.data.trade_id);
  return { success: true };
}

export async function deleteDevelopmentVersion(id: string, tradeId: string): Promise<Result> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);
  const tradeIdCheck = z.string().uuid().safeParse(tradeId);

  if (!idCheck.success || !tradeIdCheck.success) {
    return { error: "Invalid ID" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("trade_development_versions").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidate(tradeId);
  return { success: true };
}

export async function createDevelopmentCost(formData: FormData): Promise<Result> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = costSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("trade_development_costs")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidate(parsed.data.trade_id);
  return { success: true, id: data.id };
}

export async function updateDevelopmentCost(id: string, formData: FormData): Promise<Result> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid ID" };
  }

  const parsed = costSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("trade_development_costs").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidate(parsed.data.trade_id);
  return { success: true };
}

export async function deleteDevelopmentCost(id: string, tradeId: string): Promise<Result> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);
  const tradeIdCheck = z.string().uuid().safeParse(tradeId);

  if (!idCheck.success || !tradeIdCheck.success) {
    return { error: "Invalid ID" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("trade_development_costs").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidate(tradeId);
  return { success: true };
}
