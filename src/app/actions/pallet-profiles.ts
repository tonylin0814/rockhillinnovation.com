"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = { success?: true; id?: string; error?: string };

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  material: z.enum(["wood", "plastic", "paper_honeycomb"]),
  length_cm: z.coerce.number().positive("Length required"),
  width_cm: z.coerce.number().positive("Width required"),
  height_cm: z.coerce.number().positive("Height required"),
  max_weight_kg: z.coerce.number().positive("Max weight required"),
  notes: z.string().trim().nullable(),
  is_default: z.coerce.boolean().default(false),
});

function valuesFromForm(formData: FormData) {
  return {
    name: formData.get("name"),
    material: formData.get("material"),
    length_cm: formData.get("length_cm"),
    width_cm: formData.get("width_cm"),
    height_cm: formData.get("height_cm"),
    max_weight_kg: formData.get("max_weight_kg"),
    notes: formData.get("notes") || null,
    is_default: formData.get("is_default") === "true",
  };
}

export async function createPalletProfile(formData: FormData): Promise<ActionResult> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };

  const parsed = profileSchema.safeParse(valuesFromForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createServerSupabaseClient();

  if (parsed.data.is_default) {
    await supabase.from("pallet_profiles").update({ is_default: false }).eq("is_default", true);
  }

  const { data, error } = await supabase.from("pallet_profiles").insert(parsed.data).select("id").single();
  if (error) return { error: error.message };

  revalidatePath("/tools/pallet-profiles");
  revalidatePath("/tools/pallet-calculator");
  return { success: true, id: data.id };
}

export async function updatePalletProfile(id: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };

  const idCheck = z.string().uuid().safeParse(id);
  if (!idCheck.success) return { error: "Invalid pallet profile" };

  const parsed = profileSchema.safeParse(valuesFromForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createServerSupabaseClient();

  if (parsed.data.is_default) {
    await supabase.from("pallet_profiles").update({ is_default: false }).eq("is_default", true).neq("id", id);
  }

  const { error } = await supabase.from("pallet_profiles").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tools/pallet-profiles");
  revalidatePath("/tools/pallet-calculator");
  return { success: true };
}

export async function deletePalletProfile(id: string): Promise<ActionResult> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };

  const idCheck = z.string().uuid().safeParse(id);
  if (!idCheck.success) return { error: "Invalid pallet profile" };

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("pallet_profiles").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tools/pallet-profiles");
  revalidatePath("/tools/pallet-calculator");
  return { success: true };
}
