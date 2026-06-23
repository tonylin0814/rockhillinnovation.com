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
      .select("*, product:products(id, code, name_english)")
      .eq("session_id", parsed.data)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("id, code, name_english")
      .eq("status", "active")
      .order("code", { ascending: true }),
  ]);

  if (linesError || productsError) {
    return NextResponse.json({ error: linesError?.message ?? productsError?.message }, { status: 500 });
  }

  return NextResponse.json({ lines: lines ?? [], products: products ?? [] });
}
