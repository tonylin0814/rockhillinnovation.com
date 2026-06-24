"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TradeNotification } from "@/types";

export async function getNotifications(limit = 50): Promise<TradeNotification[]> {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("trade_notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as TradeNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const user = await getCurrentUser();

  if (!user) {
    return 0;
  }

  const supabase = createServerSupabaseClient();
  const { count } = await supabase
    .from("trade_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const parsed = z.string().uuid().safeParse(id);

  if (!parsed.success) {
    return;
  }

  const user = await getCurrentUser();

  if (!user) {
    return;
  }

  const supabase = createServerSupabaseClient();
  await supabase.from("trade_notifications").update({ is_read: true }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/account");
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();

  if (!user) {
    return;
  }

  const supabase = createServerSupabaseClient();
  await supabase
    .from("trade_notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  revalidatePath("/account");
}
