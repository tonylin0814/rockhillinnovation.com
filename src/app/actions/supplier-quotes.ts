"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  previous_unit_cost_rmb: number | null;
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
  previous_unit_cost_rmb: z.coerce.number().min(0, "Previous cost must be zero or greater").nullable(),
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

type DemandEntry = {
  required_quantity: number;
  source_quote_line_id: string | null;
};

async function expandComponentDemand(tradeId: string) {
  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id, working_exchange_rate")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const { data: confirmedSession, error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .select("id")
    .eq("trade_id", tradeId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  const demandRows = [];

  if (confirmedSession) {
    const { data: quoteLines, error: quoteLinesError } = await supabase
      .from("supplier_quote_lines")
      .select(
        "id, product_id, quantity, unit_price_rmb, product:products(id, product_type, components:product_components!product_components_set_product_id_fkey(component_product_id, quantity_per_set))"
      )
      .eq("session_id", confirmedSession.id)
      .not("product_id", "is", null)
      .order("sort_order", { ascending: true });

    if (quoteLinesError) {
      return { error: quoteLinesError.message };
    }

    const demandMap = new Map<string, DemandEntry>();
    const quoteLineByProductId = new Map<string, { id: string; unit_price_rmb: number }>();

    const addDemand = (productId: string, quantity: number, quoteLineId: string | null) => {
      const existing = demandMap.get(productId);

      if (existing) {
        existing.required_quantity += quantity;
        existing.source_quote_line_id = existing.source_quote_line_id ?? quoteLineId;
        return;
      }

      demandMap.set(productId, {
        required_quantity: quantity,
        source_quote_line_id: quoteLineId,
      });
    };

    for (const line of quoteLines ?? []) {
      if (line.product_id) {
        quoteLineByProductId.set(line.product_id, {
          id: line.id,
          unit_price_rmb: Number(line.unit_price_rmb),
        });
      }
    }

    for (const line of quoteLines ?? []) {
      const product = Array.isArray(line.product) ? line.product[0] : line.product;

      if (!line.product_id || !product) {
        continue;
      }

      if (product.product_type === "part") {
        addDemand(line.product_id, Number(line.quantity), line.id);
        continue;
      }

      for (const component of product.components ?? []) {
        const componentQuoteLine = quoteLineByProductId.get(component.component_product_id);

        addDemand(
          component.component_product_id,
          Number(line.quantity) * Number(component.quantity_per_set),
          componentQuoteLine?.id ?? null
        );
      }
    }

    for (const [productId, demand] of Array.from(demandMap.entries())) {
      const quoteLine = quoteLineByProductId.get(productId);
      const latestUnitCostRmb = quoteLine?.unit_price_rmb ?? null;
      const estimatedCostRmb = latestUnitCostRmb === null ? null : demand.required_quantity * latestUnitCostRmb;
      const estimatedCostUsd =
        estimatedCostRmb !== null && typeof trade.working_exchange_rate === "number" && trade.working_exchange_rate > 0
          ? estimatedCostRmb / trade.working_exchange_rate
          : null;

      demandRows.push({
        trade_id: tradeId,
        product_id: productId,
        required_quantity: demand.required_quantity,
        source_order_line_ids: [],
        source_quote_line_id: demand.source_quote_line_id,
        latest_unit_cost_rmb: latestUnitCostRmb,
        estimated_cost_rmb: estimatedCostRmb,
        estimated_cost_usd: estimatedCostUsd,
        actual_cost_usd: null,
        notes: null,
      });
    }
  }

  const { error: deleteError } = await supabase.from("component_demand").delete().eq("trade_id", tradeId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (demandRows.length) {
    const { error: insertError } = await supabase.from("component_demand").insert(demandRows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  return { success: true };
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
    const { data: confirmedSession, error: confirmedSessionError } = await supabase
      .from("supplier_quote_sessions")
      .select("id, session_number")
      .eq("trade_id", session.trade_id)
      .eq("status", "confirmed")
      .neq("id", sessionId)
      .limit(1)
      .maybeSingle();

    if (confirmedSessionError) {
      return { error: confirmedSessionError.message };
    }

    if (confirmedSession) {
      return { error: `Only one quote session can be confirmed. Round ${confirmedSession.session_number} is already confirmed.` };
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

export async function deleteQuoteSession(sessionId: string): Promise<ActionResult> {
  const access = await requireQuoteManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.string().uuid().safeParse(sessionId);

  if (!parsed.success) {
    return { error: "Invalid quote session" };
  }

  const supabase = createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .select("id, trade_id")
    .eq("id", parsed.data)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "Quote session not found" };
  }

  const { error: deleteError } = await supabase.from("supplier_quote_sessions").delete().eq("id", parsed.data);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const { data: remainingSessions, error: remainingError } = await supabase
    .from("supplier_quote_sessions")
    .select("id")
    .eq("trade_id", session.trade_id)
    .order("session_number", { ascending: true })
    .order("created_at", { ascending: true });

  if (remainingError) {
    return { error: remainingError.message };
  }

  const sessionsToRenumber = remainingSessions ?? [];

  for (let index = 0; index < sessionsToRenumber.length; index += 1) {
    const remainingSession = sessionsToRenumber[index];
    const { error: updateError } = await supabase
      .from("supplier_quote_sessions")
      .update({ session_number: index + 1 })
      .eq("id", remainingSession.id);

    if (updateError) {
      return { error: updateError.message };
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
        previous_unit_cost_rmb: values.previous_unit_cost_rmb,
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
      previous_unit_cost_rmb: line.previous_unit_cost_rmb,
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
