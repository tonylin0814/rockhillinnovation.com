import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type QuoteHistoryRow = {
  product_id: string | null;
  unit_quote_usd: number | string | null;
  session:
    | {
        quote_date: string;
        created_at: string;
      }
    | {
        quote_date: string;
        created_at: string;
      }[]
    | null;
};

type ClientQuoteHistoryRow = {
  product_id: string | null;
  unit_price_usd: number | string | null;
  session:
    | {
        quote_date: string;
        created_at: string;
      }
    | {
        quote_date: string;
        created_at: string;
      }[]
    | null;
};

function firstOrNull<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = z.string().uuid().safeParse(url.searchParams.get("sessionId"));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const [{ data: lines, error: linesError }, { data: products, error: productsError }] = await Promise.all([
    supabase
      .from("supplier_quote_lines")
      .select("*, product:products(id, code, supplier_product_code, name_english)")
      .eq("session_id", parsed.data)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("id, code, supplier_product_code, name_english")
      .eq("status", "active")
      .order("code", { ascending: true }),
  ]);

  if (linesError || productsError) {
    return NextResponse.json({ error: linesError?.message ?? productsError?.message }, { status: 500 });
  }

  const productRows = products ?? [];
  const productIds = productRows.map((product) => product.id);
  const latestCostByProductId = new Map<string, number>();
  const previousQuoteByProductId = new Map<string, number>();

  if (productIds.length) {
    const [
      { data: costRows, error: costsError },
      { data: quoteRows, error: quoteRowsError },
      { data: clientQuoteRows, error: clientQuoteRowsError },
    ] = await Promise.all([
      supabase
        .from("product_cost_history")
        .select("product_id, unit_cost_rmb")
        .in("product_id", productIds)
        .order("quoted_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("supplier_quote_lines")
        .select("product_id, unit_quote_usd, session:supplier_quote_sessions(quote_date, created_at)")
        .in("product_id", productIds)
        .neq("session_id", parsed.data)
        .gt("unit_quote_usd", 0),
      supabase
        .from("client_quotation_lines")
        .select("product_id, unit_price_usd, session:client_quotation_sessions(quote_date, created_at)")
        .in("product_id", productIds)
        .gt("unit_price_usd", 0),
    ]);

    if (costsError) {
      return NextResponse.json({ error: costsError.message }, { status: 500 });
    }

    if (quoteRowsError) {
      return NextResponse.json({ error: quoteRowsError.message }, { status: 500 });
    }

    if (clientQuoteRowsError) {
      return NextResponse.json({ error: clientQuoteRowsError.message }, { status: 500 });
    }

    for (const row of (costRows ?? []) as { product_id: string; unit_cost_rmb: number | string }[]) {
      if (!latestCostByProductId.has(row.product_id)) {
        latestCostByProductId.set(row.product_id, Number(row.unit_cost_rmb));
      }
    }

    const sortedQuoteRows = [
      ...((clientQuoteRows ?? []) as ClientQuoteHistoryRow[]).map((row) => ({
        product_id: row.product_id,
        unit_quote_usd: row.unit_price_usd,
        session: row.session,
      })),
      ...((quoteRows ?? []) as QuoteHistoryRow[]),
    ].sort((a, b) => {
      const sessionA = firstOrNull(a.session);
      const sessionB = firstOrNull(b.session);
      const dateA = sessionA?.quote_date ?? "";
      const dateB = sessionB?.quote_date ?? "";
      const createdA = sessionA?.created_at ?? "";
      const createdB = sessionB?.created_at ?? "";

      return dateB.localeCompare(dateA) || createdB.localeCompare(createdA);
    });

    for (const row of sortedQuoteRows) {
      if (row.product_id && !previousQuoteByProductId.has(row.product_id)) {
        previousQuoteByProductId.set(row.product_id, Number(row.unit_quote_usd));
      }
    }
  }

  const productsWithCosts = productRows.map((product) => ({
    ...product,
    latest_cost_rmb: latestCostByProductId.get(product.id) ?? null,
    previous_quote_usd: previousQuoteByProductId.get(product.id) ?? null,
  }));

  return NextResponse.json({ lines: lines ?? [], products: productsWithCosts });
}
