"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

const nullableUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() && value !== "none" ? value : null),
  z.string().uuid().nullable()
);

const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable()
);

const costHistorySchema = z.object({
  product_id: z.string().uuid("Product is required"),
  supplier_id: nullableUuid,
  supplier_product_code: nullableText,
  quoted_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  unit_cost_rmb: z.coerce.number().min(0, "Unit cost must be zero or greater"),
  moq: nullableText,
  quality: nullableText,
  carton_box_packaging: z.preprocess((value) => (value === "true" ? "yes" : null), z.string().nullable()),
  source: z.string().trim().min(1, "Source is required"),
  notes: nullableText,
});

const quoteHistorySchema = z.object({
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  trade_id: nullableText,
  rock_hill_code: z.string().trim().min(1, "Rock Hill code is required"),
  product_name: z.string().trim().min(1, "Product name is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  quoted_usd: z.coerce.number().min(0, "Quote must be zero or greater"),
  notes: nullableText,
});

async function requireHistoryManager() {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  return access;
}

export async function createCostHistory(formData: FormData): Promise<ActionResult> {
  const access = await requireHistoryManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = costHistorySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid cost history row" };
  }

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase.from("product_cost_history").insert(parsed.data).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/history");
  revalidatePath("/history/cost");
  revalidatePath(`/products/${parsed.data.product_id}`);
  return { success: true, id: data.id };
}

export async function updateCostHistory(id: string, formData: FormData): Promise<ActionResult> {
  const access = await requireHistoryManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid cost history ID" };
  }

  const parsed = costHistorySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid cost history row" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("product_cost_history").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/history");
  revalidatePath("/history/cost");
  revalidatePath(`/products/${parsed.data.product_id}`);
  return { success: true };
}

export async function deleteCostHistory(id: string, productId?: string): Promise<ActionResult> {
  const access = await requireHistoryManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid cost history ID" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("product_cost_history").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/history");
  revalidatePath("/history/cost");

  if (productId) {
    revalidatePath(`/products/${productId}`);
  }

  return { success: true };
}

export async function createQuoteHistory(formData: FormData): Promise<ActionResult> {
  const access = await requireHistoryManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = quoteHistorySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote history row" };
  }

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase.from("quotation_history").insert(parsed.data).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/history");
  revalidatePath("/history/quote");
  return { success: true, id: data.id };
}

export async function updateQuoteHistory(id: string, formData: FormData): Promise<ActionResult> {
  const access = await requireHistoryManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid quote history ID" };
  }

  const parsed = quoteHistorySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote history row" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("quotation_history").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/history");
  revalidatePath("/history/quote");
  return { success: true };
}

export async function deleteQuoteHistory(id: string): Promise<ActionResult> {
  const access = await requireHistoryManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid quote history ID" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("quotation_history").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/history");
  revalidatePath("/history/quote");
  return { success: true };
}
