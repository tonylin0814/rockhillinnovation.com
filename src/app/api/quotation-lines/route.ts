import { NextResponse } from "next/server";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type QuoteHistoryRow = {
  created_at: string;
  quote_date: string;
  quoted_usd: number | string | null;
  rock_hill_code: string;
  trade_id: string | null;
};

export async function GET(request: Request) {
  const access = await requireManager();

  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = z.string().uuid().safeParse(url.searchParams.get("sessionId"));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const [{ data: lines, error: linesError }, { data: products, error: productsError }] = await Promise.all([
    supabase
      .from("client_quotation_lines")
      .select("*, product:products(id, code, supplier_product_code, name_english)")
      .eq("session_id", parsed.data),
    supabase
      .from("products")
      .select("id, code, supplier_product_code, name_english")
      .eq("status", "active")
      .order("name_english", { ascending: true })
      .order("code", { ascending: true }),
  ]);

  if (linesError || productsError) {
    return NextResponse.json({ error: linesError?.message ?? productsError?.message }, { status: 500 });
  }

  const productRows = products ?? [];
  const productIds = productRows.map((product) => product.id);
  const productCodes = productRows.map((product) => product.code);
  const latestCostByProductId = new Map<string, number>();
  const previousQuoteByProductId = new Map<string, number>();
  const previousQuoteMetaByProductId = new Map<string, { quote_date: string; trade_id: string | null }>();

  if (productIds.length) {
    const [{ data: costRows, error: costsError }, { data: quoteRows, error: quoteRowsError }] = await Promise.all([
      supabase
        .from("product_cost_history")
        .select("product_id, unit_cost_rmb")
        .in("product_id", productIds)
        .order("quoted_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("quotation_history")
        .select("rock_hill_code, quoted_usd, quote_date, trade_id, created_at")
        .in("rock_hill_code", productCodes)
        .gt("quoted_usd", 0),
    ]);

    if (costsError) {
      return NextResponse.json({ error: costsError.message }, { status: 500 });
    }

    if (quoteRowsError) {
      return NextResponse.json({ error: quoteRowsError.message }, { status: 500 });
    }

    for (const row of (costRows ?? []) as { product_id: string; unit_cost_rmb: number | string }[]) {
      if (!latestCostByProductId.has(row.product_id)) {
        latestCostByProductId.set(row.product_id, Number(row.unit_cost_rmb));
      }
    }

    const productIdByCode = new Map(productRows.map((product) => [product.code, product.id]));
    const sortedQuoteRows = ((quoteRows ?? []) as QuoteHistoryRow[]).sort(
      (a, b) => b.quote_date.localeCompare(a.quote_date) || b.created_at.localeCompare(a.created_at)
    );

    for (const row of sortedQuoteRows) {
      const productId = productIdByCode.get(row.rock_hill_code);

      if (productId && !previousQuoteByProductId.has(productId)) {
        previousQuoteByProductId.set(productId, Number(row.quoted_usd));
        previousQuoteMetaByProductId.set(productId, {
          quote_date: row.quote_date,
          trade_id: row.trade_id,
        });
      }
    }
  }

  const productsWithHistory = productRows.map((product) => ({
    ...product,
    latest_cost_rmb: latestCostByProductId.get(product.id) ?? null,
    previous_quote_usd: previousQuoteByProductId.get(product.id) ?? null,
    previous_quote_date: previousQuoteMetaByProductId.get(product.id)?.quote_date ?? null,
    previous_quote_trade_id: previousQuoteMetaByProductId.get(product.id)?.trade_id ?? null,
  }));

  return NextResponse.json({ lines: lines ?? [], products: productsWithHistory });
}
