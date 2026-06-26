import type { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TradeDocument } from "@/types";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export async function getNextTradeDocumentVersion({
  category,
  supabase,
  tradeId,
}: {
  category: TradeDocument["document_category"];
  supabase: SupabaseClient;
  tradeId: string;
}) {
  const { data } = await supabase
    .from("trade_documents")
    .select("version")
    .eq("trade_id", tradeId)
    .eq("document_category", category)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.version ?? 0) + 1;
}
