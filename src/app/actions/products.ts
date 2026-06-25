"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@/lib/supabase/server";
import { buildCartonLabelHtml } from "@/lib/templates/carton-label";
import type { Product } from "@/types";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

type ComponentInput = {
  component_product_id: string;
  quantity_per_set: number;
  sort_order: number;
  notes?: string;
};

type SetCostComponentInput = {
  component_product_id: string;
  code: string;
  name: string;
  quantity_per_set: number;
  unit_cost_rmb: number;
  extended_cost_rmb: number;
  cost_date: string | null;
  source: string | null;
};

const productSchema = z
  .object({
    code: z.string().trim().min(1, "Product code is required").transform((value) => value.toUpperCase()),
    supplier_product_code: z.string().trim().nullish(),
    name_english: z.string().trim().min(1, "English name is required"),
    name_chinese: z.string().trim().nullable(),
    product_type: z.enum(["part", "set"]).default("part"),
    supplier_id: z.string().uuid("Invalid supplier").nullable(),
    payment_category: z.enum(["outsourced", "produced"]).nullable(),
    status: z.enum(["active", "inactive"]).default("active"),
    notes: z.string().trim().nullable(),
    packaging_required: z.coerce.boolean().default(false),
    has_carton: z.coerce.boolean().default(false),
    product_length_cm: nullableNonNegativeNumber(),
    product_width_cm: nullableNonNegativeNumber(),
    product_height_cm: nullableNonNegativeNumber(),
    product_weight_kg: nullableNonNegativeNumber(),
    product_art_notes: z.string().trim().nullable(),
    qty_per_carton: nullableNonNegativeNumber(),
    carton_height_cm: nullableNonNegativeNumber(),
    carton_width_cm: nullableNonNegativeNumber(),
    carton_length_cm: nullableNonNegativeNumber(),
    carton_weight_kg: nullableNonNegativeNumber(),
    cartons_per_pallet_std: nullableNonNegativeNumber(),
    cartons_per_pallet_hq: nullableNonNegativeNumber(),
    country_of_origin: z.string().trim().min(1, "Country of origin is required").default("CHINA"),
  })
  .superRefine((value, context) => {
    if (value.product_type === "part" && !value.payment_category) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Payment category is required for products",
        path: ["payment_category"],
      });
    }
  })
  .transform((value) => ({
    ...value,
    supplier_product_code: value.product_type === "part" ? value.supplier_product_code ?? null : null,
    payment_category: value.product_type === "part" ? value.payment_category : null,
    has_carton: value.product_type === "set" ? value.has_carton : false,
    qty_per_carton: value.packaging_required ? value.qty_per_carton : null,
    carton_height_cm: value.packaging_required ? value.carton_height_cm : null,
    carton_width_cm: value.packaging_required ? value.carton_width_cm : null,
    carton_length_cm: value.packaging_required ? value.carton_length_cm : null,
    carton_weight_kg: value.packaging_required ? value.carton_weight_kg : null,
    cartons_per_pallet_std: value.packaging_required ? value.cartons_per_pallet_std : null,
    cartons_per_pallet_hq: value.packaging_required ? value.cartons_per_pallet_hq : null,
    country_of_origin: value.country_of_origin || "CHINA",
  }));

const componentInputSchema = z.object({
  component_product_id: z.string().uuid("Invalid component product"),
  quantity_per_set: z.coerce.number().positive("Quantity per set must be greater than 0"),
  sort_order: z.coerce.number().int().min(0),
  notes: z.string().trim().optional(),
});

const setCostComponentSchema = z.object({
  component_product_id: z.string().uuid(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  quantity_per_set: z.coerce.number().positive(),
  unit_cost_rmb: z.coerce.number().min(0),
  extended_cost_rmb: z.coerce.number().min(0),
  cost_date: z.string().nullable(),
  source: z.string().trim().nullable(),
});

async function requireProductManager() {
  const user = await getCurrentUser();

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
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

function nullableNonNegativeNumber() {
  return z.preprocess(
    (value) => {
      if (value === null || typeof value === "undefined") {
        return null;
      }

      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    },
    z.coerce.number().nonnegative("Value cannot be negative").nullable()
  );
}

function valuesFromForm(formData: FormData, fallback?: Product) {
  const productType = formData.has("product_type")
    ? formData.get("product_type") || "part"
    : fallback?.product_type ?? "part";

  return {
    code: formData.has("code") ? formData.get("code") : fallback?.code,
    supplier_product_code: formData.has("supplier_product_code")
      ? emptyToNull(formData.get("supplier_product_code"))
      : fallback?.supplier_product_code,
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
    packaging_required: formData.has("packaging_required")
      ? formData.get("packaging_required") === "true"
      : fallback?.packaging_required ?? false,
    has_carton: formData.has("has_carton") ? formData.get("has_carton") === "true" : fallback?.has_carton ?? false,
    product_length_cm: formData.has("product_length_cm")
      ? formData.get("product_length_cm")
      : fallback?.product_length_cm ?? null,
    product_width_cm: formData.has("product_width_cm")
      ? formData.get("product_width_cm")
      : fallback?.product_width_cm ?? null,
    product_height_cm: formData.has("product_height_cm")
      ? formData.get("product_height_cm")
      : fallback?.product_height_cm ?? null,
    product_weight_kg: formData.has("product_weight_kg")
      ? formData.get("product_weight_kg")
      : fallback?.product_weight_kg ?? null,
    product_art_notes: formData.has("product_art_notes")
      ? emptyToNull(formData.get("product_art_notes"))
      : fallback?.product_art_notes ?? null,
    qty_per_carton: formData.has("qty_per_carton") ? formData.get("qty_per_carton") : fallback?.qty_per_carton ?? null,
    carton_height_cm: formData.has("carton_height_cm")
      ? formData.get("carton_height_cm")
      : fallback?.carton_height_cm ?? null,
    carton_width_cm: formData.has("carton_width_cm")
      ? formData.get("carton_width_cm")
      : fallback?.carton_width_cm ?? null,
    carton_length_cm: formData.has("carton_length_cm")
      ? formData.get("carton_length_cm")
      : fallback?.carton_length_cm ?? null,
    carton_weight_kg: formData.has("carton_weight_kg")
      ? formData.get("carton_weight_kg")
      : fallback?.carton_weight_kg ?? null,
    cartons_per_pallet_std: formData.has("cartons_per_pallet_std")
      ? formData.get("cartons_per_pallet_std")
      : fallback?.cartons_per_pallet_std ?? null,
    cartons_per_pallet_hq: formData.has("cartons_per_pallet_hq")
      ? formData.get("cartons_per_pallet_hq")
      : fallback?.cartons_per_pallet_hq ?? null,
    country_of_origin: formData.has("country_of_origin")
      ? formData.get("country_of_origin")
      : fallback?.country_of_origin ?? "CHINA",
  };
}

function productErrorMessage(message: string, code?: string) {
  if (code === "23505" || message.toLowerCase().includes("products_code_unique_idx")) {
    return "Rock Hill product code already exists";
  }

  return message;
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
    return { error: productErrorMessage(error.message, error.code) };
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
    return { error: productErrorMessage(error.message, error.code) };
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

export async function saveSetComponents(
  setProductId: string,
  components: ComponentInput[]
): Promise<ActionResult> {
  const access = await requireProductManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const setIdCheck = z.string().uuid().safeParse(setProductId);

  if (!setIdCheck.success) {
    return { error: "Invalid set product ID" };
  }

  const parsedComponents = z.array(componentInputSchema).safeParse(components);

  if (!parsedComponents.success) {
    return { error: parsedComponents.error.issues[0]?.message ?? "Invalid set components" };
  }

  const supabase = createServerSupabaseClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, product_type")
    .eq("id", setProductId)
    .maybeSingle();

  if (productError) {
    return { error: productError.message };
  }

  if (!product || product.product_type !== "set") {
    return { error: "Set product not found" };
  }

  const { error: deleteError } = await supabase.from("product_components").delete().eq("set_product_id", setProductId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (parsedComponents.data.length) {
    const rows = parsedComponents.data.map((component, index) => ({
      set_product_id: setProductId,
      component_product_id: component.component_product_id,
      quantity_per_set: component.quantity_per_set,
      sort_order: index + 1,
      notes: component.notes?.trim() || null,
    }));

    const { error: insertError } = await supabase.from("product_components").insert(rows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath("/products");
  revalidatePath(`/products/${setProductId}`);
  return { success: true };
}

export async function saveSetCostSnapshot(
  setProductId: string,
  totalCostRmb: number,
  components: SetCostComponentInput[]
): Promise<ActionResult> {
  const access = await requireProductManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      setProductId: z.string().uuid(),
      totalCostRmb: z.coerce.number().min(0),
      components: z.array(setCostComponentSchema).min(1, "Set needs at least one component"),
    })
    .safeParse({ setProductId, totalCostRmb, components });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid set cost snapshot" };
  }

  const supabase = createServerSupabaseAdmin();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, code, product_type")
    .eq("id", parsed.data.setProductId)
    .maybeSingle();

  if (productError) {
    return { error: productError.message };
  }

  if (!product || product.product_type !== "set") {
    return { error: "Set product not found" };
  }

  const today = new Date().toISOString().slice(0, 10);
  const breakdown = parsed.data.components
    .map((component) => {
      const costDate = component.cost_date ? `, date ${component.cost_date}` : "";
      const source = component.source ? `, source ${component.source}` : "";

      return `${component.code} ${component.name}: ${component.quantity_per_set} x RMB ${component.unit_cost_rmb.toFixed(
        4
      )} = RMB ${component.extended_cost_rmb.toFixed(4)}${costDate}${source}`;
    })
    .join("\n");

  const { data, error } = await supabase
    .from("product_cost_history")
    .insert({
      product_id: parsed.data.setProductId,
      quoted_date: today,
      unit_cost_rmb: Number(parsed.data.totalCostRmb.toFixed(4)),
      source: "set cost snapshot",
      notes: `Calculated from Set Builder components on ${today}\n${breakdown}`,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${parsed.data.setProductId}`);
  revalidatePath("/history");
  return { success: true, id: data.id };
}

export async function generateCartonLabelPdf(productId: string, totalCartons: number): Promise<ActionResult & { url?: string }> {
  const access = await requireProductManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      productId: z.string().uuid(),
      totalCartons: z.coerce.number().int().positive("Total cartons must be greater than 0"),
    })
    .safeParse({ productId, totalCartons });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid carton label request" };
  }

  const supabase = createServerSupabaseClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("*, supplier:suppliers(id, name, code)")
    .eq("id", parsed.data.productId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!product) {
    return { error: "Product not found" };
  }

  const html = buildCartonLabelHtml({ product: product as Product, totalCartons: parsed.data.totalCartons });
  const pdf = await generatePdf(html);

  return { success: true, url: `data:application/pdf;base64,${pdf.toString("base64")}` };
}
