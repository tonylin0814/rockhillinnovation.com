"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = { success?: true; error?: string };

async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return { error: "Admin access required" };
  }

  return { user };
}

function formText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function upsertCompanySettings(formData: FormData): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      address_line1: z.string().nullable(),
      address_line2: z.string().nullable(),
      city_state: z.string().nullable(),
      company_name: z.string().min(1, "Company name is required"),
      company_name_full: z.string().nullable(),
      country: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      sales_contact_email: z.string().nullable(),
      sales_contact_name: z.string().nullable(),
      sales_contact_phone: z.string().nullable(),
      website: z.string().nullable(),
    })
    .safeParse({
      address_line1: formText(formData, "address_line1"),
      address_line2: formText(formData, "address_line2"),
      city_state: formText(formData, "city_state"),
      company_name: formText(formData, "company_name") ?? "Rock Hill Innovation Co., Ltd",
      company_name_full: formText(formData, "company_name_full"),
      country: formText(formData, "country"),
      email: formText(formData, "email"),
      phone: formText(formData, "phone"),
      sales_contact_email: formText(formData, "sales_contact_email"),
      sales_contact_name: formText(formData, "sales_contact_name"),
      sales_contact_phone: formText(formData, "sales_contact_phone"),
      website: formText(formData, "website"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const supabase = createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("company_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message };
  }

  const { error } = existing
    ? await supabase
        .from("company_settings")
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    : await supabase.from("company_settings").insert(parsed.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

const bankingSchema = z.object({
  account_name: z.string().trim().min(1, "Account name is required"),
  account_number: z.string().trim().nullable(),
  bank_address: z.string().trim().nullable(),
  bank_branch: z.string().trim().nullable(),
  bank_name: z.string().trim().min(1, "Bank name is required"),
  currency: z.string().trim().min(1, "Currency is required"),
  iban: z.string().trim().nullable(),
  intermediary_bank: z.string().trim().nullable(),
  label: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  routing_number: z.string().trim().nullable(),
  sort_order: z.number().int().default(0),
  swift_code: z.string().trim().nullable(),
});

function parseBankingForm(formData: FormData) {
  return bankingSchema.safeParse({
    account_name: formText(formData, "account_name"),
    account_number: formText(formData, "account_number"),
    bank_address: formText(formData, "bank_address"),
    bank_branch: formText(formData, "bank_branch"),
    bank_name: formText(formData, "bank_name"),
    currency: formText(formData, "currency"),
    iban: formText(formData, "iban"),
    intermediary_bank: formText(formData, "intermediary_bank"),
    label: formText(formData, "label"),
    notes: formText(formData, "notes"),
    routing_number: formText(formData, "routing_number"),
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
    swift_code: formText(formData, "swift_code"),
  });
}

export async function createBankingAccount(formData: FormData): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = parseBankingForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("company_banking_accounts").insert(parsed.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updateBankingAccount(id: string, formData: FormData): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Invalid ID" };
  }

  const parsed = parseBankingForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("company_banking_accounts").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function toggleBankingAccountActive(id: string, isActive: boolean): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Invalid ID" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("company_banking_accounts").update({ is_active: isActive }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function deleteBankingAccount(id: string): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Invalid ID" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("company_banking_accounts").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/settings");
  return { success: true };
}
