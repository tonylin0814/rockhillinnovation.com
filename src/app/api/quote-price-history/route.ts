import { NextResponse } from "next/server";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type JoinedHistoryRow = {
  id: string;
  unit_price_rmb: number;
  quantity: number;
  payment_category: string | null;
  session:
    | {
        id: string;
        session_number: number;
        quote_date: string;
        status: string;
        trade:
          | {
              id: string;
              trade_id: string;
              trade_date: string;
            }
          | {
              id: string;
              trade_id: string;
              trade_date: string;
            }[]
          | null;
      }
    | {
        id: string;
        session_number: number;
        quote_date: string;
        status: string;
        trade:
          | {
              id: string;
              trade_id: string;
              trade_date: string;
            }
          | {
              id: string;
              trade_id: string;
              trade_date: string;
            }[]
          | null;
      }[]
    | null;
  product:
    | {
        id: string;
        code: string;
        name_english: string;
      }
    | {
        id: string;
        code: string;
        name_english: string;
      }[]
    | null;
};

function firstOrNull<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(request: Request) {
  const access = await requireManager();

  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = z.string().uuid().safeParse(url.searchParams.get("productId"));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("supplier_quote_lines")
    .select(
      `
        id,
        unit_price_rmb,
        quantity,
        payment_category,
        session:supplier_quote_sessions(
          id,
          session_number,
          quote_date,
          status,
          trade:trades(id, trade_id, trade_date)
        ),
        product:products(id, code, name_english)
      `
    )
    .eq("product_id", parsed.data)
    .order("session_id", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const history = ((data ?? []) as JoinedHistoryRow[])
    .map((row) => {
      const session = firstOrNull(row.session);
      const trade = firstOrNull(session?.trade);
      const product = firstOrNull(row.product);

      if (!session || !trade || !product) {
        return null;
      }

      return {
        id: row.id,
        unit_price_rmb: Number(row.unit_price_rmb),
        quantity: Number(row.quantity),
        payment_category: row.payment_category,
        session_number: session.session_number,
        quote_date: session.quote_date,
        session_status: session.status,
        trade_id: trade.id,
        trade_code: trade.trade_id,
        product_code: product.code,
        product_name: product.name_english,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      const dateCompare = new Date(b.quote_date).getTime() - new Date(a.quote_date).getTime();
      return dateCompare || a.trade_code.localeCompare(b.trade_code);
    });

  return NextResponse.json({ history });
}
