"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import type { AiConfig } from "@/types";

type ActionResult = { success?: true; error?: string };

async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (user.role !== "admin") {
    return { error: "Admin access required" };
  }

  return { user };
}

export async function getAiConfigs(): Promise<AiConfig[]> {
  const access = await requireAdmin();

  if ("error" in access) {
    return [];
  }

  const supabase = createServerSupabaseAdmin();
  const { data } = await supabase.from("ai_configs").select("*").like("key", "prompt.%").order("key");
  return (data ?? []) as AiConfig[];
}

export async function updateAiConfig(key: string, value: string): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      key: z.string().trim().min(1),
      value: z.string().trim().min(1, "Prompt cannot be blank"),
    })
    .safeParse({ key, value });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid AI config" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase
    .from("ai_configs")
    .update({ updated_at: new Date().toISOString(), updated_by: access.user.id, value: parsed.data.value })
    .eq("key", parsed.data.key);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/settings");
  return { success: true };
}
