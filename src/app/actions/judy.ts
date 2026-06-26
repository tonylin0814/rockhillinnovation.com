"use server";

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type JudyMessage = { role: "user" | "assistant"; content: string };
export type JudyResult = { reply: string } | { error: string };

const messageSchema = z.object({
  content: z.string().min(1).max(4000),
  role: z.enum(["user", "assistant"]),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function askJudy(tradeId: string, messages: JudyMessage[]): Promise<JudyResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const tradeIdParsed = z.string().uuid().safeParse(tradeId);

  if (!tradeIdParsed.success) {
    return { error: "Invalid trade" };
  }

  const messagesParsed = z.array(messageSchema).max(30).safeParse(messages);

  if (!messagesParsed.success) {
    return { error: "Invalid messages" };
  }

  const supabase = createServerSupabaseClient();

  const [
    { data: trade },
    { data: componentDemand },
    { data: quoteSessions },
    { data: quotationSessions },
    { data: clientInvoices },
    { data: supplierInvoices },
    { data: ledgerEntries },
    { data: shareholderBook },
    { data: shareholders },
  ] = await Promise.all([
    supabase
      .from("trades")
      .select("*, client:clients(name, code, currency, deposit_pct, final_pct)")
      .eq("id", tradeId)
      .maybeSingle(),
    supabase
      .from("component_demand")
      .select("*, product:products(code, name_english, payment_category)")
      .eq("trade_id", tradeId),
    supabase
      .from("supplier_quote_sessions")
      .select(
        `id, session_number, quote_date, status, recorded_by, notes,
         supplier_quote_lines(id, item_name_english, item_name_chinese, quantity, unit_price_rmb, unit_quote_usd, payment_category, notes, sort_order,
                              product:products(code, name_english))`
      )
      .eq("trade_id", tradeId)
      .order("session_number", { ascending: false }),
    supabase
      .from("client_quotation_sessions")
      .select(
        `id, session_number, quote_date, status, notes,
         client_quotation_lines(id, item_description, quantity, unit_price_usd, total_price_usd, notes,
                                product:products(code, name_english))`
      )
      .eq("trade_id", tradeId)
      .order("session_number", { ascending: false }),
    supabase.from("client_invoices").select("invoice_number, invoice_type, status, total_usd").eq("trade_id", tradeId),
    supabase
      .from("supplier_invoices_outgoing")
      .select("invoice_number, invoice_type, status, total_rmb, total_usd")
      .eq("trade_id", tradeId),
    supabase
      .from("trade_ledger")
      .select("entry_date, entry_type, direction, amount_usd, amount_rmb, notes")
      .eq("trade_id", tradeId)
      .order("entry_date", { ascending: false })
      .limit(30),
    supabase
      .from("shareholder_book")
      .select(
        "gross_profit_usd, expense_deductions_usd, taxable_base_usd, corporate_tax_usd, net_profit_usd, per_share_usd, status"
      )
      .eq("trade_id", tradeId)
      .maybeSingle(),
    supabase
      .from("trade_shareholders")
      .select("person_name, split_pct, invoices_through_entity")
      .eq("trade_id", tradeId),
  ]);

  if (!trade) {
    return { error: "Trade not found" };
  }

  const client = Array.isArray(trade.client) ? trade.client[0] : trade.client;

  const context = JSON.stringify(
    {
      client_invoices: clientInvoices ?? [],
      client_quotation_sessions: quotationSessions ?? [],
      component_demand: componentDemand ?? [],
      recent_ledger_entries: ledgerEntries ?? [],
      shareholder_book: shareholderBook ?? null,
      shareholders: shareholders ?? [],
      supplier_invoices_outgoing: supplierInvoices ?? [],
      supplier_quote_sessions: quoteSessions ?? [],
      trade: {
        client,
        corporate_tax_rate: trade.corporate_tax_rate,
        notes: trade.notes,
        order_number: trade.order_number,
        status: trade.status,
        trade_date: trade.trade_date,
        trade_id: trade.trade_id,
        working_exchange_rate: trade.working_exchange_rate,
      },
    },
    null,
    2
  );

  const systemPrompt = `You are Judy, an internal trade assistant for Rock Hill Innovation Inc., a trading company that sources products from Chinese manufacturers and sells them to international clients.

You have complete access to the data for a specific trade. Your job is to answer questions about this trade clearly and concisely: financials, invoice status, payment progress, shareholder distributions, cost breakdowns, etc.

Speak like a helpful coworker in a natural business conversation, not like a textbook or calculator worksheet.

Default answer style:
- Start with the direct answer in one short sentence.
- Keep the response brief unless the user asks for details.
- For profit/margin questions, give the final profit and margin first, then one compact support line showing revenue, cost, and exchange rate.
- Do not write long numbered walkthroughs, LaTeX formulas, or step-by-step math unless the user explicitly asks "show me the calculation" or "break it down".
- Use plain language like "Tasting Set looks like about $39.3k profit, around 61.8% margin."
- When quoting numbers, be precise and include units (USD or RMB).
- If something is unclear or missing from the data, say so directly rather than guessing.

TRADE DATA:
${context}`;

  try {
    const completionMessages: ChatCompletionMessageParam[] = [
      { content: systemPrompt, role: "system" },
      ...messagesParsed.data,
    ];
    const completion = await openai.chat.completions.create({
      max_tokens: 1024,
      messages: completionMessages,
      model: "gpt-4o-mini",
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content;

    if (!reply) {
      return { error: "No response from Judy" };
    }

    return { reply };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI error";
    return { error: message };
  }
}
