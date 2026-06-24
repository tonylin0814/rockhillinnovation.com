"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import type { UserClientAccess } from "@/types";

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

export async function setUserClientAccess(
  userId: string,
  clientId: string,
  accessLevel: "read" | "edit"
): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      accessLevel: z.enum(["read", "edit"]),
      clientId: z.string().uuid(),
      userId: z.string().uuid(),
    })
    .safeParse({ accessLevel, clientId, userId });

  if (!parsed.success) {
    return { error: "Invalid client access grant" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("user_client_access").upsert({
    access_level: parsed.data.accessLevel,
    client_id: parsed.data.clientId,
    granted_by: access.user.id,
    user_id: parsed.data.userId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function removeUserClientAccess(userId: string, clientId: string): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      clientId: z.string().uuid(),
      userId: z.string().uuid(),
    })
    .safeParse({ clientId, userId });

  if (!parsed.success) {
    return { error: "Invalid client access grant" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase
    .from("user_client_access")
    .delete()
    .eq("user_id", parsed.data.userId)
    .eq("client_id", parsed.data.clientId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function getUserClientAccess(userId: string): Promise<UserClientAccess[]> {
  const access = await requireAdmin();

  if ("error" in access) {
    return [];
  }

  const parsed = z.string().uuid().safeParse(userId);

  if (!parsed.success) {
    return [];
  }

  const supabase = createServerSupabaseAdmin();
  const { data } = await supabase
    .from("user_client_access")
    .select("*, client:clients(id, code, name)")
    .eq("user_id", parsed.data)
    .order("granted_at", { ascending: true });

  return (data ?? []) as UserClientAccess[];
}
