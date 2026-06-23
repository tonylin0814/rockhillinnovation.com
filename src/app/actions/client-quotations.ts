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

type QuotationLineInput = {
  id?: string;
  product_id: string | null;
  item_description: string | null;
  quantity: number;
  unit_price_usd: number;
  notes: string | null;
};

const quotationSessionSchema = z.object({
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Quote date is required"),
  notes: z.string().trim().nullable(),
});

const quotationLineSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable(),
  item_description: z.string().trim().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit_price_usd: z.coerce.number().min(0, "Unit price must be zero or greater"),
  notes: z.string().trim().nullable(),
});

async function requireQuotationManager() {
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

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

export async function createQuotationSession(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireQuotationManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      tradeId: z.string().uuid(),
      session: quotationSessionSchema,
    })
    .safeParse({
      tradeId,
      session: {
        quote_date: formData.get("quote_date"),
        notes: emptyToNull(formData.get("notes")),
      },
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quotation session" };
  }

  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id, client_id")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const { data: latestSession, error: latestError } = await supabase
    .from("client_quotation_sessions")
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
    .from("client_quotation_sessions")
    .insert({
      trade_id: tradeId,
      client_id: trade.client_id,
      session_number: nextSessionNumber,
      quote_date: parsed.data.session.quote_date,
      notes: parsed.data.session.notes,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true, id: data.id };
}

export async function updateQuotationSessionStatus(
  sessionId: string,
  status: "draft" | "sent" | "accepted" | "rejected"
): Promise<ActionResult> {
  const access = await requireQuotationManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      status: z.enum(["draft", "sent", "accepted", "rejected"]),
    })
    .safeParse({ sessionId, status });

  if (!parsed.success) {
    return { error: "Invalid quotation session status" };
  }

  const supabase = createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("client_quotation_sessions")
    .select("id, trade_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "Quotation session not found" };
  }

  const { error } = await supabase.from("client_quotation_sessions").update({ status }).eq("id", sessionId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${session.trade_id}`);
  return { success: true };
}

export async function saveQuotationLines(sessionId: string, lines: QuotationLineInput[]): Promise<ActionResult> {
  const access = await requireQuotationManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      lines: z.array(quotationLineSchema),
    })
    .safeParse({ sessionId, lines });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quotation lines" };
  }

  const supabase = createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("client_quotation_sessions")
    .select("id, trade_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "Quotation session not found" };
  }

  const { data: existingLines, error: existingError } = await supabase
    .from("client_quotation_lines")
    .select("id")
    .eq("session_id", sessionId);

  if (existingError) {
    return { error: existingError.message };
  }

  const incomingIds = new Set(parsed.data.lines.filter((line) => line.id).map((line) => line.id));
  const deleteIds = (existingLines ?? []).map((line) => line.id).filter((id) => !incomingIds.has(id));

  if (deleteIds.length) {
    const { error: deleteError } = await supabase.from("client_quotation_lines").delete().in("id", deleteIds);

    if (deleteError) {
      return { error: deleteError.message };
    }
  }

  const linesToUpdate = parsed.data.lines.filter((line) => line.id);
  const linesToInsert = parsed.data.lines.filter((line) => !line.id);

  for (const line of linesToUpdate) {
    const { id, ...values } = line;
    const { error: updateError } = await supabase
      .from("client_quotation_lines")
      .update({
        product_id: values.product_id,
        item_description: normalizeText(values.item_description),
        quantity: values.quantity,
        unit_price_usd: values.unit_price_usd,
        notes: normalizeText(values.notes),
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
      item_description: normalizeText(line.item_description),
      quantity: line.quantity,
      unit_price_usd: line.unit_price_usd,
      notes: normalizeText(line.notes),
    }));

    const { error: insertError } = await supabase.from("client_quotation_lines").insert(rows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath(`/trades/${session.trade_id}`);
  return { success: true };
}
