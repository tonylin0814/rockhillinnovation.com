import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  if (productIds.length) {
    const { data: costRows, error: costsError } = await supabase
      .from("product_cost_history")
      .select("product_id, unit_cost_rmb")
      .in("product_id", productIds)
      .order("quoted_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (costsError) {
      return NextResponse.json({ error: costsError.message }, { status: 500 });
    }

    for (const row of (costRows ?? []) as { product_id: string; unit_cost_rmb: number | string }[]) {
      if (!latestCostByProductId.has(row.product_id)) {
        latestCostByProductId.set(row.product_id, Number(row.unit_cost_rmb));
      }
    }
  }

  const productsWithCosts = productRows.map((product) => ({
    ...product,
    latest_cost_rmb: latestCostByProductId.get(product.id) ?? null,
  }));

  return NextResponse.json({ lines: lines ?? [], products: productsWithCosts });
}
