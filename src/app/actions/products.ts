"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product } from "@/types";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

const productSchema = z
  .object({
    code: z.string().trim().min(1, "Product code is required").transform((value) => value.toUpperCase()),
    name_english: z.string().trim().min(1, "English name is required"),
    name_chinese: z.string().trim().nullable(),
    product_type: z.enum(["part", "set"]).default("part"),
    supplier_id: z.string().uuid("Invalid supplier").nullable(),
    payment_category: z.enum(["outsourced", "produced"]).nullable(),
    status: z.enum(["active", "inactive"]).default("active"),
    notes: z.string().trim().nullable(),
  })
  .superRefine((value, context) => {
    if (value.product_type === "part" && !value.payment_category) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Payment category is required for parts",
        path: ["payment_category"],
      });
    }
  })
  .transform((value) => ({
    ...value,
    payment_category: value.product_type === "part" ? value.payment_category : null,
  }));

async function requireProductManager() {
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
  return trimmed.length && trimmed !== "none" ? trimmed : null;
}

function valuesFromForm(formData: FormData, fallback?: Product) {
  const productType = formData.has("product_type")
    ? formData.get("product_type") || "part"
    : fallback?.product_type ?? "part";

  return {
    code: formData.has("code") ? formData.get("code") : fallback?.code,
    name_english: formData.has("name_english") ? formData.get("name_english") : fallback?.name_english,
    name_chinese: formData.has("name_chinese") ? emptyToNull(formData.get("name_chinese")) : fallback?.name_chinese,
    product_type: productType,
    supplier_id: formData.has("supplier_id") ? emptyToNull(formData.get("supplier_id")) : fallback?.supplier_id,
    payment_category:
      productType === "part"
        ? formData.has("payment_category")
          ? emptyToNull(formData.get("payment_category"))
          : fallback?.payment_category
        : null,
    status: formData.has("status") ? formData.get("status") || "active" : fallback?.status ?? "active",
    notes: formData.has("notes") ? emptyToNull(formData.get("notes")) : fallback?.notes,
  };
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const access = await requireProductManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = productSchema.safeParse(valuesFromForm(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product details" };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("products").insert(parsed.data).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { success: true, id: data.id };
}

export async function updateProduct(id: string, formData: FormData): Promise<ActionResult> {
  const access = await requireProductManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return { error: "Invalid product ID" };
  }

  const supabase = createServerSupabaseClient();
  const { data: existingProduct, error: fetchError } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!existingProduct) {
    return { error: "Product not found" };
  }

  const parsed = productSchema.safeParse(valuesFromForm(formData, existingProduct as Product));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product details" };
  }

  const { error } = await supabase.from("products").update(parsed.data).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { success: true };
}

export async function setProductStatus(id: string, status: "active" | "inactive"): Promise<ActionResult> {
  const access = await requireProductManager();

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
    return { error: "Invalid product status update" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("products").update({ status }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { success: true };
}
