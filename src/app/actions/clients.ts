"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Client, Contact } from "@/types";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

const contactSchema = z.object({
  name: z.string().trim().default(""),
  first_name: z.string().trim().default(""),
  last_name: z.string().trim().default(""),
  role: z.string().trim().default(""),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  cell_phone: z.string().trim().default(""),
});

const clientSchema = z.object({
  code: z.string().trim().min(1, "Client code is required").transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "Company name is required"),
  dba_name: z.string().trim().nullable(),
  website: z.string().trim().nullable(),
  country: z.string().trim().nullable(),
  currency: z.string().trim().min(1).default("USD"),
  deposit_pct: z.coerce.number().min(0).max(100),
  final_pct: z.coerce.number().min(0).max(100),
  contacts: z.array(contactSchema).default([]),
  address: z.string().trim().nullable(),
  shipping_address: z.string().trim().nullable(),
  bank_name: z.string().trim().nullable(),
  bank_branch: z.string().trim().nullable(),
  bank_account_name: z.string().trim().nullable(),
  bank_account_number: z.string().trim().nullable(),
  bank_swift_code: z.string().trim().nullable(),
  bank_address: z.string().trim().nullable(),
  bank_tel: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
});

async function requireClientManager() {
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

function parseContacts(value: FormDataEntryValue | null): Contact[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  const parsed = JSON.parse(value);
  return z.array(contactSchema).parse(parsed).map((contact) => ({
    ...contact,
    name: contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(" "),
  }));
}

function valuesFromForm(formData: FormData, fallback?: Client) {
  return {
    code: formData.has("code") ? formData.get("code") : fallback?.code,
    name: formData.has("name") ? formData.get("name") : fallback?.name,
    dba_name: formData.has("dba_name") ? emptyToNull(formData.get("dba_name")) : fallback?.dba_name,
    website: formData.has("website") ? emptyToNull(formData.get("website")) : fallback?.website,
    country: formData.has("country") ? emptyToNull(formData.get("country")) : fallback?.country,
    currency: formData.has("currency") ? formData.get("currency") || "USD" : fallback?.currency ?? "USD",
    deposit_pct: formData.has("deposit_pct") ? formData.get("deposit_pct") : fallback?.deposit_pct,
    final_pct: formData.has("final_pct") ? formData.get("final_pct") : fallback?.final_pct,
    contacts: formData.has("contacts") ? parseContacts(formData.get("contacts")) : fallback?.contacts ?? [],
    address: formData.has("address") ? emptyToNull(formData.get("address")) : fallback?.address,
    shipping_address: formData.has("shipping_address")
      ? emptyToNull(formData.get("shipping_address"))
      : fallback?.shipping_address,
    bank_name: formData.has("bank_name") ? emptyToNull(formData.get("bank_name")) : fallback?.bank_name,
    bank_branch: formData.has("bank_branch") ? emptyToNull(formData.get("bank_branch")) : fallback?.bank_branch,
    bank_account_name: formData.has("bank_account_name")
      ? emptyToNull(formData.get("bank_account_name"))
      : fallback?.bank_account_name,
    bank_account_number: formData.has("bank_account_number")
      ? emptyToNull(formData.get("bank_account_number"))
      : fallback?.bank_account_number,
    bank_swift_code: formData.has("bank_swift_code")
      ? emptyToNull(formData.get("bank_swift_code"))
      : fallback?.bank_swift_code,
    bank_address: formData.has("bank_address") ? emptyToNull(formData.get("bank_address")) : fallback?.bank_address,
    bank_tel: formData.has("bank_tel") ? emptyToNull(formData.get("bank_tel")) : fallback?.bank_tel,
    notes: formData.has("notes") ? emptyToNull(formData.get("notes")) : fallback?.notes,
  };
}

export async function createClient(formData: FormData): Promise<ActionResult> {
  const access = await requireClientManager();

  if ("error" in access) {
    return { error: access.error };
  }

  let parsed;

  try {
    parsed = clientSchema.safeParse(valuesFromForm(formData));
  } catch {
    return { error: "Contacts must be valid JSON" };
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid client details" };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("clients").insert(parsed.data).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clients");
  return { success: true, id: data.id };
}

export async function updateClient(id: string, formData: FormData): Promise<ActionResult> {
  const access = await requireClientManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid client ID" };
  }

  const supabase = createServerSupabaseClient();
  const { data: existingClient, error: fetchError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!existingClient) {
    return { error: "Client not found" };
  }

  let parsed;

  try {
    parsed = clientSchema.safeParse(valuesFromForm(formData, existingClient as Client));
  } catch {
    return { error: "Contacts must be valid JSON" };
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid client details" };
  }

  const { error } = await supabase.from("clients").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { success: true };
}

export async function setClientStatus(id: string, status: "active" | "inactive"): Promise<ActionResult> {
  const access = await requireClientManager();

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
    return { error: "Invalid client status update" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("clients").update({ status }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { success: true };
}
