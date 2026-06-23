"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = {
  success?: true;
  error?: string;
};

type OrderLineInput = {
  id?: string;
  original_item_name: string | null;
  product_id: string | null;
  quantity: number;
  unit_price_usd: number;
  notes: string | null;
  sort_order: number;
};

type DemandEntry = {
  required_quantity: number;
  source_order_line_ids: string[];
};

const orderLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  original_item_name: z.string().trim().nullable(),
  product_id: z.string().uuid().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit_price_usd: z.coerce.number().min(0, "Unit price must be zero or greater"),
  notes: z.string().trim().nullable(),
  sort_order: z.coerce.number().int().min(1, "Sort order must be 1 or greater"),
});

async function requireOrderLineManager() {
  const user = await getCurrentUser();

  if (!user || user.role === "partner") {
    return { error: "Access denied" };
  }

  return { user };
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

export async function expandComponentDemand(tradeId: string) {
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

  const { data: orderLines, error: orderLinesError } = await supabase
    .from("order_lines")
    .select(
      "id, product_id, quantity, product:products(id, product_type, components:product_components!product_components_set_product_id_fkey(component_product_id, quantity_per_set))"
    )
    .eq("trade_id", tradeId)
    .order("sort_order", { ascending: true });

  if (orderLinesError) {
    return { error: orderLinesError.message };
  }

  const demandMap = new Map<string, DemandEntry>();

  function addDemand(productId: string, quantity: number, orderLineId: string) {
    const existing = demandMap.get(productId);

    if (existing) {
      existing.required_quantity += quantity;
      existing.source_order_line_ids.push(orderLineId);
      return;
    }

    demandMap.set(productId, {
      required_quantity: quantity,
      source_order_line_ids: [orderLineId],
    });
  }

  for (const line of orderLines ?? []) {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;

    if (!line.product_id || !product) {
      continue;
    }

    if (product.product_type === "part") {
      addDemand(line.product_id, Number(line.quantity), line.id);
      continue;
    }

    for (const component of product.components ?? []) {
      addDemand(
        component.component_product_id,
        Number(line.quantity) * Number(component.quantity_per_set),
        line.id
      );
    }
  }

  const { data: confirmedSessions, error: sessionsError } = await supabase
    .from("supplier_quote_sessions")
    .select("id")
    .eq("trade_id", tradeId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });

  if (sessionsError) {
    return { error: sessionsError.message };
  }

  const confirmedSessionIds = (confirmedSessions ?? []).map((session) => session.id);
  const demandRows = [];

  for (const [productId, demand] of Array.from(demandMap.entries())) {
    let sourceQuoteLineId: string | null = null;
    let latestUnitCostRmb: number | null = null;
    let estimatedCostRmb: number | null = null;
    let estimatedCostUsd: number | null = null;

    for (const sessionId of confirmedSessionIds) {
      const { data: quoteLine, error: quoteLineError } = await supabase
        .from("supplier_quote_lines")
        .select("id, unit_price_rmb")
        .eq("product_id", productId)
        .eq("session_id", sessionId)
        .limit(1)
        .maybeSingle();

      if (quoteLineError) {
        return { error: quoteLineError.message };
      }

      if (quoteLine) {
        sourceQuoteLineId = quoteLine.id;
        latestUnitCostRmb = Number(quoteLine.unit_price_rmb);
        estimatedCostRmb = demand.required_quantity * latestUnitCostRmb;
        estimatedCostUsd =
          typeof trade.working_exchange_rate === "number" && trade.working_exchange_rate > 0
            ? estimatedCostRmb / trade.working_exchange_rate
            : null;
        break;
      }
    }

    demandRows.push({
      trade_id: tradeId,
      product_id: productId,
      required_quantity: demand.required_quantity,
      source_order_line_ids: demand.source_order_line_ids,
      source_quote_line_id: sourceQuoteLineId,
      latest_unit_cost_rmb: latestUnitCostRmb,
      estimated_cost_rmb: estimatedCostRmb,
      estimated_cost_usd: estimatedCostUsd,
      actual_cost_usd: null,
      notes: null,
    });
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

export async function saveOrderLines(tradeId: string, lines: OrderLineInput[]): Promise<ActionResult> {
  const access = await requireOrderLineManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      tradeId: z.string().uuid(),
      lines: z.array(orderLineInputSchema),
    })
    .safeParse({ tradeId, lines });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order lines" };
  }

  const supabase = createServerSupabaseClient();
  const { data: existingLines, error: existingError } = await supabase
    .from("order_lines")
    .select("id")
    .eq("trade_id", tradeId);

  if (existingError) {
    return { error: existingError.message };
  }

  const incomingIds = new Set(parsed.data.lines.filter((line) => line.id).map((line) => line.id));
  const deleteIds = (existingLines ?? [])
    .map((line) => line.id)
    .filter((id) => !incomingIds.has(id));

  if (deleteIds.length) {
    const { error: deleteError } = await supabase.from("order_lines").delete().in("id", deleteIds);

    if (deleteError) {
      return { error: deleteError.message };
    }
  }

  const linesToUpdate = parsed.data.lines.filter((line) => line.id);
  const linesToInsert = parsed.data.lines.filter((line) => !line.id);

  for (const line of linesToUpdate) {
    const { id, ...values } = line;
    const { error: updateError } = await supabase
      .from("order_lines")
      .update({
        original_item_name: normalizeText(values.original_item_name),
        product_id: values.product_id,
        quantity: values.quantity,
        unit_price_usd: values.unit_price_usd,
        notes: normalizeText(values.notes),
        sort_order: values.sort_order,
      })
      .eq("id", id)
      .eq("trade_id", tradeId);

    if (updateError) {
      return { error: updateError.message };
    }
  }

  if (linesToInsert.length) {
    const rows = linesToInsert.map((line) => ({
      trade_id: tradeId,
      original_item_name: normalizeText(line.original_item_name),
      product_id: line.product_id,
      quantity: line.quantity,
      unit_price_usd: line.unit_price_usd,
      notes: normalizeText(line.notes),
      sort_order: line.sort_order,
    }));

    const { error: insertError } = await supabase.from("order_lines").insert(rows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  const expansion = await expandComponentDemand(tradeId);

  if (expansion.error) {
    return { error: expansion.error };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}
