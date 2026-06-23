"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { expandComponentDemand } from "@/app/actions/order-lines";
import { getCurrentUser } from "@/lib/auth";
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
  session_id: z.string().uuid("Quote session is required"),
  product_id: nullableUuid,
  item_name_chinese: nullableText,
  item_name_english: nullableText,
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit_price_rmb: z.coerce.number().min(0, "Unit price must be zero or greater"),
  payment_category: z.preprocess(
    (value) => (typeof value === "string" && value !== "none" ? value : null),
    z.enum(["outsourced", "produced", "misc_expense"]).nullable()
  ),
  sort_order: z.coerce.number().int().min(0).default(0),
  notes: nullableText,
});

async function requireHistoryManager() {
  const user = await getCurrentUser();

  if (!user || user.role === "partner") {
    return { error: "Access denied" };
  }

  return { user };
}

async function getSessionTradeId(sessionId: string) {
  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("supplier_quote_sessions")
    .select("trade_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Quote session not found" };
  }

  return { tradeId: data.trade_id as string, status: data.status as string };
}

async function refreshHistoryAndTrade(tradeId?: string, confirmed?: boolean) {
  if (tradeId && confirmed) {
    await expandComponentDemand(tradeId);
  }

  revalidatePath("/history");

  if (tradeId) {
    revalidatePath(`/trades/${tradeId}`);
  }
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

  const sessionResult = await getSessionTradeId(parsed.data.session_id);

  if ("error" in sessionResult) {
    return { error: sessionResult.error };
  }

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase.from("supplier_quote_lines").insert(parsed.data).select("id").single();

  if (error) {
    return { error: error.message };
  }

  await refreshHistoryAndTrade(sessionResult.tradeId, sessionResult.status === "confirmed");
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

  const sessionResult = await getSessionTradeId(parsed.data.session_id);

  if ("error" in sessionResult) {
    return { error: sessionResult.error };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("supplier_quote_lines").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  await refreshHistoryAndTrade(sessionResult.tradeId, sessionResult.status === "confirmed");
  return { success: true };
}

export async function deleteQuoteHistory(id: string, sessionId?: string): Promise<ActionResult> {
  const access = await requireHistoryManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid quote history ID" };
  }

  let sessionResult: Awaited<ReturnType<typeof getSessionTradeId>> | null = null;

  if (sessionId) {
    sessionResult = await getSessionTradeId(sessionId);

    if ("error" in sessionResult) {
      return { error: sessionResult.error };
    }
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("supplier_quote_lines").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  await refreshHistoryAndTrade(
    sessionResult && "tradeId" in sessionResult ? sessionResult.tradeId : undefined,
    sessionResult && "status" in sessionResult ? sessionResult.status === "confirmed" : false
  );
  return { success: true };
}
