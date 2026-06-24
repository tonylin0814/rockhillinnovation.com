"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { expandComponentDemand } from "@/app/actions/order-lines";
import { requireManager } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

type QuoteLineInput = {
  id?: string;
  product_id: string | null;
  item_name_chinese: string | null;
  item_name_english: string | null;
  quantity: number;
  unit_price_rmb: number;
  unit_quote_usd: number;
  payment_category: "outsourced" | "produced" | "misc_expense" | null;
  notes: string | null;
  sort_order: number;
};

const quoteSessionSchema = z.object({
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Quote date is required"),
  recorded_by: z.enum(["chatgpt", "judy", "manual"]).default("manual"),
  notes: z.string().trim().nullable(),
  source_document_url: z.string().trim().nullable(),
});

const quoteLineSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable(),
  item_name_chinese: z.string().trim().nullable(),
  item_name_english: z.string().trim().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit_price_rmb: z.coerce.number().min(0, "Unit price must be zero or greater"),
  unit_quote_usd: z.coerce.number().min(0, "Quote must be zero or greater"),
  payment_category: z.enum(["outsourced", "produced", "misc_expense"]).nullable(),
  notes: z.string().trim().nullable(),
  sort_order: z.coerce.number().int().min(1, "Sort order must be 1 or greater"),
});

async function requireQuoteManager() {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  return access;
}

function emptyToNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

export async function createQuoteSession(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireQuoteManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      tradeId: z.string().uuid(),
      session: quoteSessionSchema,
    })
    .safeParse({
      tradeId,
      session: {
        quote_date: formData.get("quote_date"),
        recorded_by: formData.get("recorded_by") || "manual",
        notes: emptyToNull(formData.get("notes")),
        source_document_url: emptyToNull(formData.get("source_document_url")),
      },
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote session" };
  }

  const supabase = createServerSupabaseClient();
  const { data: latestSession, error: latestError } = await supabase
    .from("supplier_quote_sessions")
    .select("session_number")
    .eq("trade_id", tradeId)
    .order("session_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    return { error: latestError.message };
  }

  const nextSessionNumber = (latestSession?.session_number ?? 0) + 1;
  const { data, error } = await supabase
    .from("supplier_quote_sessions")
    .insert({
      trade_id: tradeId,
      session_number: nextSessionNumber,
      quote_date: parsed.data.session.quote_date,
      recorded_by: parsed.data.session.recorded_by,
      notes: parsed.data.session.notes,
      source_document_url: parsed.data.session.source_document_url,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true, id: data.id };
}

export async function updateQuoteSessionStatus(
  sessionId: string,
  status: "draft" | "confirmed" | "superseded"
): Promise<ActionResult> {
  const access = await requireQuoteManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      status: z.enum(["draft", "confirmed", "superseded"]),
    })
    .safeParse({ sessionId, status });

  if (!parsed.success) {
    return { error: "Invalid quote session status" };
  }

  const supabase = createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .select("id, trade_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "Quote session not found" };
  }

  if (status === "confirmed") {
    const { error: supersedeError } = await supabase
      .from("supplier_quote_sessions")
      .update({ status: "superseded" })
      .eq("trade_id", session.trade_id)
      .neq("id", sessionId);

    if (supersedeError) {
      return { error: supersedeError.message };
    }
  }

  const { error } = await supabase.from("supplier_quote_sessions").update({ status }).eq("id", sessionId);

  if (error) {
    return { error: error.message };
  }

  if (status === "confirmed" || status === "superseded") {
    const expansion = await expandComponentDemand(session.trade_id);

    if (expansion.error) {
      return { error: expansion.error };
    }
  }

  revalidatePath(`/trades/${session.trade_id}`);
  return { success: true };
}

export async function saveQuoteLines(sessionId: string, lines: QuoteLineInput[]): Promise<ActionResult> {
  const access = await requireQuoteManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      lines: z.array(quoteLineSchema),
    })
    .safeParse({ sessionId, lines });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote lines" };
  }

  const supabase = createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .select("id, trade_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "Quote session not found" };
  }

  const { data: existingLines, error: existingError } = await supabase
    .from("supplier_quote_lines")
    .select("id")
    .eq("session_id", sessionId);

  if (existingError) {
    return { error: existingError.message };
  }

  const incomingIds = new Set(parsed.data.lines.filter((line) => line.id).map((line) => line.id));
  const deleteIds = (existingLines ?? []).map((line) => line.id).filter((id) => !incomingIds.has(id));

  if (deleteIds.length) {
    const { error: deleteError } = await supabase.from("supplier_quote_lines").delete().in("id", deleteIds);

    if (deleteError) {
      return { error: deleteError.message };
    }
  }

  const linesToUpdate = parsed.data.lines.filter((line) => line.id);
  const linesToInsert = parsed.data.lines.filter((line) => !line.id);

  for (const line of linesToUpdate) {
    const { id, ...values } = line;
    const { error: updateError } = await supabase
      .from("supplier_quote_lines")
      .update({
        product_id: values.product_id,
        item_name_chinese: normalizeText(values.item_name_chinese),
        item_name_english: normalizeText(values.item_name_english),
        quantity: values.quantity,
        unit_price_rmb: values.unit_price_rmb,
        unit_quote_usd: values.unit_quote_usd,
        payment_category: values.payment_category,
        notes: normalizeText(values.notes),
        sort_order: values.sort_order,
      })
      .eq("id", id)
      .eq("session_id", sessionId);

    if (updateError) {
      return { error: updateError.message };
    }
  }

  if (linesToInsert.length) {
    const rows = linesToInsert.map((line) => ({
      session_id: sessionId,
      product_id: line.product_id,
      item_name_chinese: normalizeText(line.item_name_chinese),
      item_name_english: normalizeText(line.item_name_english),
      quantity: line.quantity,
      unit_price_rmb: line.unit_price_rmb,
      unit_quote_usd: line.unit_quote_usd,
      payment_category: line.payment_category,
      notes: normalizeText(line.notes),
      sort_order: line.sort_order,
    }));

    const { error: insertError } = await supabase.from("supplier_quote_lines").insert(rows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  if (session.status === "confirmed") {
    const expansion = await expandComponentDemand(session.trade_id);

    if (expansion.error) {
      return { error: expansion.error };
    }
  }

  revalidatePath(`/trades/${session.trade_id}`);
  return { success: true };
}
