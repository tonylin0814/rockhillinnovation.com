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

const quoteSessionSchema = z.object({
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Quote date is required"),
  recorded_by: z.enum(["chatgpt", "judy", "manual"]).default("manual"),
  notes: z.string().trim().nullable(),
});

async function requireQuoteManager() {
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
    const { error: supersedeError } = await supabase
      .from("supplier_quote_sessions")
      .update({ status: "superseded" })
      .eq("trade_id", session.trade_id)
      .neq("id", sessionId);

    if (supersedeError) {
      return { error: supersedeError.message };
    }
  }

  const { error } = await supabase.from("supplier_quote_sessions").update({ status }).eq("id", sessionId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${session.trade_id}`);
  return { success: true };
}
