"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Supplier, SupplierContact } from "@/types";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

const supplierContactSchema = z.object({
  name: z.string().trim().default(""),
  role: z.string().trim().default(""),
  email: z.string().trim().default(""),
  wechat: z.string().trim().default(""),
  phone: z.string().trim().default(""),
});

const supplierSchema = z.object({
  code: z.string().trim().min(1, "Supplier code is required").transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "English name is required"),
  name_chinese: z.string().trim().nullable(),
  country: z.string().trim().nullable(),
  website: z.string().trim().nullable(),
  tel: z.string().trim().nullable(),
  currency: z.literal("RMB").default("RMB"),
  invoice_format: z.enum(["image", "excel"]).default("image"),
  contacts: z.array(supplierContactSchema).default([]),
  address: z.string().trim().nullable(),
  bank_account_name: z.string().trim().nullable(),
  bank_account_number: z.string().trim().nullable(),
  bank_currency: z.string().trim().nullable(),
  bank_name: z.string().trim().nullable(),
  bank_address: z.string().trim().nullable(),
  bank_institution_no: z.string().trim().nullable(),
  bank_transit_no: z.string().trim().nullable(),
  bank_cnaps_no: z.string().trim().nullable(),
  bank_swift_code: z.string().trim().nullable(),
  bank_tel: z.string().trim().nullable(),
  banking_instructions: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
});

async function requireSupplierManager() {
  const user = await getCurrentUser();

  if (!user || user.role === "partner") {
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

function parseContacts(value: FormDataEntryValue | null): SupplierContact[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  const parsed = JSON.parse(value);
  return z.array(supplierContactSchema).parse(parsed);
}

function valuesFromForm(formData: FormData, fallback?: Supplier) {
  return {
    code: formData.has("code") ? formData.get("code") : fallback?.code,
    name: formData.has("name") ? formData.get("name") : fallback?.name,
    name_chinese: formData.has("name_chinese") ? emptyToNull(formData.get("name_chinese")) : fallback?.name_chinese,
    country: formData.has("country") ? emptyToNull(formData.get("country")) : fallback?.country,
    website: formData.has("website") ? emptyToNull(formData.get("website")) : fallback?.website,
    tel: formData.has("tel") ? emptyToNull(formData.get("tel")) : fallback?.tel,
    currency: "RMB",
    invoice_format: formData.has("invoice_format")
      ? formData.get("invoice_format") || "image"
      : fallback?.invoice_format ?? "image",
    contacts: formData.has("contacts") ? parseContacts(formData.get("contacts")) : fallback?.contacts ?? [],
    address: formData.has("address") ? emptyToNull(formData.get("address")) : fallback?.address,
    bank_account_name: formData.has("bank_account_name")
      ? emptyToNull(formData.get("bank_account_name"))
      : fallback?.bank_account_name,
    bank_account_number: formData.has("bank_account_number")
      ? emptyToNull(formData.get("bank_account_number"))
      : fallback?.bank_account_number,
    bank_currency: formData.has("bank_currency")
      ? emptyToNull(formData.get("bank_currency"))
      : fallback?.bank_currency,
    bank_name: formData.has("bank_name") ? emptyToNull(formData.get("bank_name")) : fallback?.bank_name,
    bank_address: formData.has("bank_address") ? emptyToNull(formData.get("bank_address")) : fallback?.bank_address,
    bank_institution_no: formData.has("bank_institution_no")
      ? emptyToNull(formData.get("bank_institution_no"))
      : fallback?.bank_institution_no,
    bank_transit_no: formData.has("bank_transit_no")
      ? emptyToNull(formData.get("bank_transit_no"))
      : fallback?.bank_transit_no,
    bank_cnaps_no: formData.has("bank_cnaps_no")
      ? emptyToNull(formData.get("bank_cnaps_no"))
      : fallback?.bank_cnaps_no,
    bank_swift_code: formData.has("bank_swift_code")
      ? emptyToNull(formData.get("bank_swift_code"))
      : fallback?.bank_swift_code,
    bank_tel: formData.has("bank_tel") ? emptyToNull(formData.get("bank_tel")) : fallback?.bank_tel,
    banking_instructions: formData.has("banking_instructions")
      ? emptyToNull(formData.get("banking_instructions"))
      : fallback?.banking_instructions,
    notes: formData.has("notes") ? emptyToNull(formData.get("notes")) : fallback?.notes,
  };
}

export async function createSupplier(formData: FormData): Promise<ActionResult> {
  const access = await requireSupplierManager();

  if ("error" in access) {
    return { error: access.error };
  }

  let parsed;

  try {
    parsed = supplierSchema.safeParse(valuesFromForm(formData));
  } catch {
    return { error: "Contacts must be valid JSON" };
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid supplier details" };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("suppliers").insert(parsed.data).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/suppliers");
  return { success: true, id: data.id };
}

export async function updateSupplier(id: string, formData: FormData): Promise<ActionResult> {
  const access = await requireSupplierManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid supplier ID" };
  }

  const supabase = createServerSupabaseClient();
  const { data: existingSupplier, error: fetchError } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!existingSupplier) {
    return { error: "Supplier not found" };
  }

  let parsed;

  try {
    parsed = supplierSchema.safeParse(valuesFromForm(formData, existingSupplier as Supplier));
  } catch {
    return { error: "Contacts must be valid JSON" };
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid supplier details" };
  }

  const { error } = await supabase.from("suppliers").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { success: true };
}

export async function setSupplierStatus(id: string, status: "active" | "inactive"): Promise<ActionResult> {
  const access = await requireSupplierManager();

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
    return { error: "Invalid supplier status update" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("suppliers").update({ status }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { success: true };
}
