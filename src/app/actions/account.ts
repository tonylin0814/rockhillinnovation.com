"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AccountResult = { success?: true; error?: string };

export async function updateProfile(formData: FormData): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const parsed = z
    .object({ name: z.string().trim().min(1, "Name is required").max(100) })
    .safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("users").update({ name: parsed.data.name }).eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updatePassword(formData: FormData): Promise<AccountResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const parsed = z
    .object({
      confirm: z.string(),
      password: z.string().min(8, "Password must be at least 8 characters"),
    })
    .refine((data) => data.password === data.confirm, {
      message: "Passwords do not match",
      path: ["confirm"],
    })
    .safeParse({
      confirm: formData.get("confirm"),
      password: formData.get("password"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
