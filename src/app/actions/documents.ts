"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { notifyParticipants } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TradeDocument } from "@/types";

type ActionResult = {
  success?: true;
  error?: string;
};

const statusSchema = z.enum(["draft", "sent", "approved", "sent_to_printer", "archived"]);

export async function updateDocumentStatus(
  documentId: string,
  status: TradeDocument["status"]
): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const parsed = z
    .object({
      documentId: z.string().uuid(),
      status: statusSchema,
    })
    .safeParse({ documentId, status });

  if (!parsed.success) {
    return { error: "Invalid document status" };
  }

  const supabase = createServerSupabaseClient();
  const { data: document, error: documentError } = await supabase
    .from("trade_documents")
    .select("id, trade_id, trade:trades(trade_id)")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) {
    return { error: documentError.message };
  }

  if (!document) {
    return { error: "Document not found" };
  }

  const { error } = await supabase.from("trade_documents").update({ status }).eq("id", documentId);

  if (error) {
    return { error: error.message };
  }

  if (status === "approved") {
    const trade = Array.isArray(document.trade) ? document.trade[0] : document.trade;
    const tradeCode = trade?.trade_id ?? document.trade_id;
    await notifyParticipants(
      document.trade_id,
      tradeCode,
      user.id,
      user.name,
      `A document was updated on trade ${tradeCode}.`
    );
  }

  revalidatePath(`/trades/${document.trade_id}`);
  return { success: true };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const parsed = z.string().uuid().safeParse(documentId);

  if (!parsed.success) {
    return { error: "Invalid document ID" };
  }

  const supabase = createServerSupabaseClient();
  const { data: document, error: fetchError } = await supabase
    .from("trade_documents")
    .select("id, trade_id")
    .eq("id", documentId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!document) {
    return { error: "Document not found" };
  }

  const { error } = await supabase.from("trade_documents").delete().eq("id", documentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${document.trade_id}`);
  return { success: true };
}
