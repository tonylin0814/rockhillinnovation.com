"use server";

import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type NotificationInput = {
  tradeId: string;
  tradeCode: string;
  actorId: string;
  actorName: string;
  message: string;
};

export async function notifyParticipants(
  tradeId: string,
  tradeCode: string,
  actorId: string,
  actorName: string,
  message: string
): Promise<void> {
  const supabase = createServerSupabaseAdmin();
  const { data: participants } = await supabase
    .from("trade_participants")
    .select("user_id")
    .eq("trade_id", tradeId)
    .neq("user_id", actorId);

  const userIds = Array.from(new Set((participants ?? []).map((participant) => participant.user_id).filter(Boolean)));
  await notifyUsers(userIds, { tradeId, tradeCode, actorId, actorName, message });
}

export async function notifyUsers(userIds: string[], input: NotificationInput): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds)).filter((userId) => userId && userId !== input.actorId);

  if (!uniqueUserIds.length) {
    return;
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("trade_notifications").insert(
    uniqueUserIds.map((userId) => ({
      actor_id: input.actorId,
      actor_name: input.actorName,
      message: input.message,
      trade_code: input.tradeCode,
      trade_id: input.tradeId,
      user_id: userId,
    }))
  );

  if (error) {
    console.error("Notification insert failed", error);
  }
}
