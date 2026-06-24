import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function logActivity(params: {
  tradeId?: string;
  user: { id: string; name: string; role: string };
  action: "created" | "updated" | "deleted";
  targetTable: string;
  targetId?: string;
  summary: string;
}): Promise<void> {
  try {
    const supabase = createServerSupabaseAdmin();
    await supabase.from("trade_activity_log").insert({
      action: params.action,
      summary: params.summary,
      target_id: params.targetId ?? null,
      target_table: params.targetTable,
      trade_id: params.tradeId ?? null,
      user_id: params.user.id,
      user_name: params.user.name,
      user_role: params.user.role,
    });
  } catch (error) {
    console.error("Activity log failed", error);
  }
}
