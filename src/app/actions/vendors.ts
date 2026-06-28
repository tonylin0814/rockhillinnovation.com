"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExpenseVendor, VendorContact } from "@/types";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

const vendorContactSchema = z.object({
  name: z.string().trim().default(""),
  role: z.string().trim().default(""),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
});

const vendorSchema = z.object({
  code: z.string().trim().min(1, "Vendor code is required").transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "Full name is required"),
  country: z.string().trim().nullable(),
  vendor_type: z.enum(["legal", "consulting", "maintenance", "related_company"]),
  letterhead_onedrive_url: z.string().trim().nullable(),
  contacts: z.array(vendorContactSchema).default([]),
  address: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  bank_account_name: z.string().trim().nullable(),
  bank_account_number: z.string().trim().nullable(),
  bank_name: z.string().trim().nullable(),
  bank_address: z.string().trim().nullable(),
  bank_swift_code: z.string().trim().nullable(),
  bank_aba_routing: z.string().trim().nullable(),
  bank_institution_no: z.string().trim().nullable(),
  bank_transit_no: z.string().trim().nullable(),
  bank_tel: z.string().trim().nullable(),
  bank_currency: z.string().trim().nullable(),
  banking_instructions: z.string().trim().nullable(),
});

async function requireVendorManager() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return { error: "Access denied" };
  }

  return { user };
}

function emptyToNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseContacts(value: FormDataEntryValue | null): VendorContact[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  const parsed = JSON.parse(value);
  return z.array(vendorContactSchema).parse(parsed);
}

function valuesFromForm(formData: FormData, fallback?: ExpenseVendor) {
  return {
    code: formData.has("code") ? formData.get("code") : fallback?.code,
    name: formData.has("name") ? formData.get("name") : fallback?.name,
    country: formData.has("country") ? emptyToNull(formData.get("country")) : fallback?.country,
    vendor_type: formData.has("vendor_type") ? formData.get("vendor_type") : fallback?.vendor_type,
    letterhead_onedrive_url: formData.has("letterhead_onedrive_url")
      ? emptyToNull(formData.get("letterhead_onedrive_url"))
      : fallback?.letterhead_onedrive_url,
    contacts: formData.has("contacts") ? parseContacts(formData.get("contacts")) : fallback?.contacts ?? [],
    address: formData.has("address") ? emptyToNull(formData.get("address")) : fallback?.address,
    notes: formData.has("notes") ? emptyToNull(formData.get("notes")) : fallback?.notes,
    bank_account_name: formData.has("bank_account_name")
      ? emptyToNull(formData.get("bank_account_name"))
      : fallback?.bank_account_name,
    bank_account_number: formData.has("bank_account_number")
      ? emptyToNull(formData.get("bank_account_number"))
      : fallback?.bank_account_number,
    bank_name: formData.has("bank_name") ? emptyToNull(formData.get("bank_name")) : fallback?.bank_name,
    bank_address: formData.has("bank_address") ? emptyToNull(formData.get("bank_address")) : fallback?.bank_address,
    bank_swift_code: formData.has("bank_swift_code")
      ? emptyToNull(formData.get("bank_swift_code"))
      : fallback?.bank_swift_code,
    bank_aba_routing: formData.has("bank_aba_routing")
      ? emptyToNull(formData.get("bank_aba_routing"))
      : fallback?.bank_aba_routing,
    bank_institution_no: formData.has("bank_institution_no")
      ? emptyToNull(formData.get("bank_institution_no"))
      : fallback?.bank_institution_no,
    bank_transit_no: formData.has("bank_transit_no")
      ? emptyToNull(formData.get("bank_transit_no"))
      : fallback?.bank_transit_no,
    bank_tel: formData.has("bank_tel") ? emptyToNull(formData.get("bank_tel")) : fallback?.bank_tel,
    bank_currency: formData.has("bank_currency") ? emptyToNull(formData.get("bank_currency")) : fallback?.bank_currency,
    banking_instructions: formData.has("banking_instructions")
      ? emptyToNull(formData.get("banking_instructions"))
      : fallback?.banking_instructions,
  };
}

export async function createVendor(formData: FormData): Promise<ActionResult> {
  const access = await requireVendorManager();

  if ("error" in access) {
    return { error: access.error };
  }

  let parsed;

  try {
    parsed = vendorSchema.safeParse(valuesFromForm(formData));
  } catch {
    return { error: "Contacts must be valid JSON" };
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vendor details" };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("expense_vendors").insert(parsed.data).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/vendors");
  return { success: true, id: data.id };
}

export async function updateVendor(id: string, formData: FormData): Promise<ActionResult> {
  const access = await requireVendorManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid vendor ID" };
  }

  const supabase = createServerSupabaseClient();
  const { data: existingVendor, error: fetchError } = await supabase
    .from("expense_vendors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!existingVendor) {
    return { error: "Vendor not found" };
  }

  let parsed;

  try {
    parsed = vendorSchema.safeParse(valuesFromForm(formData, existingVendor as ExpenseVendor));
  } catch {
    return { error: "Contacts must be valid JSON" };
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vendor details" };
  }

  const { error } = await supabase.from("expense_vendors").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { success: true };
}

export async function setVendorStatus(id: string, status: "active" | "inactive"): Promise<ActionResult> {
  const access = await requireVendorManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["active", "inactive"]),
    })
    .safeParse({ id, status });

  if (!parsed.success) {
    return { error: "Invalid vendor status update" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("expense_vendors").update({ status }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { success: true };
}
