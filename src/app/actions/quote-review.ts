"use server";

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type QuoteReviewResult = { review: string } | { error: string };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function reviewQuoteSession(sessionId: string): Promise<QuoteReviewResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const idParsed = z.string().uuid().safeParse(sessionId);

  if (!idParsed.success) {
    return { error: "Invalid session ID" };
  }

  const supabase = createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .select("id, session_number, quote_date, status, trade:trades(trade_id)")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "Quote session not found" };
  }

  const { data: lines, error: linesError } = await supabase
    .from("supplier_quote_lines")
    .select(
      "id, product_id, item_name_chinese, item_name_english, quantity, unit_price_rmb, total_price_rmb, payment_category, notes, product:products(code, name_english)"
    )
    .eq("session_id", sessionId)
    .order("sort_order");

  if (linesError) {
    return { error: linesError.message };
  }

  if (!lines?.length) {
    return { error: "No quote lines to review" };
  }

  const productIds = Array.from(new Set(lines.map((line) => line.product_id).filter(Boolean))) as string[];
  const { data: confirmedSessions, error: confirmedSessionsError } = await supabase
    .from("supplier_quote_sessions")
    .select("id")
    .eq("status", "confirmed")
    .neq("id", sessionId);

  if (confirmedSessionsError) {
    return { error: confirmedSessionsError.message };
  }

  const confirmedSessionIds = (confirmedSessions ?? []).map((confirmedSession) => confirmedSession.id);
  let priceHistory: { product_id: string | null; unit_price_rmb: number }[] = [];

  if (confirmedSessionIds.length > 0 && productIds.length > 0) {
    const { data: historyRows, error: historyError } = await supabase
      .from("supplier_quote_lines")
      .select("product_id, unit_price_rmb")
      .in("product_id", productIds)
      .in("session_id", confirmedSessionIds)
      .limit(200);

    if (historyError) {
      return { error: historyError.message };
    }

    priceHistory = historyRows ?? [];
  }

  const historyMap: Record<string, { prices: number[]; avg: number }> = {};

  for (const row of priceHistory) {
    if (!row.product_id) {
      continue;
    }

    if (!historyMap[row.product_id]) {
      historyMap[row.product_id] = { avg: 0, prices: [] };
    }

    historyMap[row.product_id].prices.push(Number(row.unit_price_rmb));
  }

  for (const id of Object.keys(historyMap)) {
    const { prices } = historyMap[id];
    historyMap[id].avg = Math.round((prices.reduce((total, price) => total + price, 0) / prices.length) * 100) / 100;
  }

  const linesContext = lines.map((line) => {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;
    const history = line.product_id ? historyMap[line.product_id] : null;

    return {
      item_name_chinese: line.item_name_chinese,
      item_name_english: line.item_name_english,
      notes: line.notes ?? null,
      payment_category: line.payment_category,
      price_history: history ? { avg_price_rmb: history.avg, sample_count: history.prices.length } : null,
      product_code: product?.code ?? null,
      quantity: line.quantity,
      total_price_rmb: Number(line.total_price_rmb),
      unit_price_rmb: Number(line.unit_price_rmb),
    };
  });

  const trade = Array.isArray(session.trade) ? session.trade[0] : session.trade;
  const systemPrompt = `You are a trade pricing analyst for Rock Hill Innovation Inc., a company that sources products from Chinese manufacturers for international clients.

Review the supplier quote lines below. Your analysis should:

1. Start with a one-line verdict: ACCEPT / NEGOTIATE / REVIEW NEEDED
2. Give a brief overall summary (2-3 sentences max)
3. List per-line notes ONLY for lines that have issues: price deviations >15% from historical average, missing information, or mismatched payment categories
4. End with any recommended actions

Flag guidelines:
- Price >15% above historical avg: flag as high
- Price >15% below historical avg: flag as suspiciously low (check quality)
- No historical data: note as "first occurrence"
- payment_category null or "none": flag as uncategorized

Use plain text. No markdown. Keep it under 400 words.`;
  const userContent = `Trade: ${trade?.trade_id ?? "Unknown"} | Quote Round ${session.session_number} | Date: ${session.quote_date}

Lines:
${JSON.stringify(linesContext, null, 2)}`;

  try {
    const messages: ChatCompletionMessageParam[] = [
      { content: systemPrompt, role: "system" },
      { content: userContent, role: "user" },
    ];
    const completion = await openai.chat.completions.create({
      max_tokens: 800,
      messages,
      model: "gpt-4o-mini",
      temperature: 0.1,
    });
    const review = completion.choices[0]?.message?.content;

    if (!review) {
      return { error: "No review generated" };
    }

    return { review };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "OpenAI error" };
  }
}
