"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { z } from "zod";

import {
  buildPalletSideViewSvg,
  buildPalletTopViewSvg,
  calculatePallet,
  type CartonInput,
  type PalletInput,
} from "@/lib/pallet-calculator";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildPalletCalculationHtml } from "@/lib/templates/pallet-calculator";
import { getCurrentUser, requireManager } from "@/lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ActionResult = {
  success?: true;
  url?: string;
  error?: string;
};

const palletCalculationSchema = z.object({
  product_name: z.string().trim().min(1, "Product name is required"),
  carton_length_cm: z.coerce.number().positive("Carton length must be greater than 0"),
  carton_width_cm: z.coerce.number().positive("Carton width must be greater than 0"),
  carton_height_cm: z.coerce.number().positive("Carton height must be greater than 0"),
  carton_weight_kg: z.coerce.number().positive("Carton weight must be greater than 0"),
  qty_per_carton: z.coerce.number().int().positive("Qty per carton must be greater than 0"),
  pallet_length_cm: z.coerce.number().positive("Pallet length must be greater than 0"),
  pallet_width_cm: z.coerce.number().positive("Pallet width must be greater than 0"),
  pallet_height_cm: z.coerce.number().positive("Pallet height must be greater than 0"),
  pallet_max_weight_kg: z.coerce.number().positive("Pallet max weight must be greater than 0"),
  container_pallets: z.coerce.number().int().positive().nullable(),
});

function emptyToNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return value;
}

export async function generatePalletCalculationPdf(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return { error: "Access denied" };
  }

  const parsed = palletCalculationSchema.safeParse({
    product_name: formData.get("product_name"),
    carton_length_cm: formData.get("carton_length_cm"),
    carton_width_cm: formData.get("carton_width_cm"),
    carton_height_cm: formData.get("carton_height_cm"),
    carton_weight_kg: formData.get("carton_weight_kg"),
    qty_per_carton: formData.get("qty_per_carton"),
    pallet_length_cm: formData.get("pallet_length_cm"),
    pallet_width_cm: formData.get("pallet_width_cm"),
    pallet_height_cm: formData.get("pallet_height_cm"),
    pallet_max_weight_kg: formData.get("pallet_max_weight_kg"),
    container_pallets: emptyToNull(formData.get("container_pallets")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid pallet calculation" };
  }

  const carton: CartonInput = {
    heightCm: parsed.data.carton_height_cm,
    lengthCm: parsed.data.carton_length_cm,
    qtyPerCarton: parsed.data.qty_per_carton,
    weightKg: parsed.data.carton_weight_kg,
    widthCm: parsed.data.carton_width_cm,
  };
  const pallet: PalletInput = {
    lengthCm: parsed.data.pallet_length_cm,
    maxHeightCm: parsed.data.pallet_height_cm,
    maxWeightKg: parsed.data.pallet_max_weight_kg,
    widthCm: parsed.data.pallet_width_cm,
  };
  const calculation = calculatePallet(carton, pallet);
  const topViewSvg = buildPalletTopViewSvg(carton, pallet, calculation);
  const sideViewSvg = buildPalletSideViewSvg(carton, pallet, calculation);
  const supabase = createServerSupabaseClient();
  const { data: companySettings } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
  const html = buildPalletCalculationHtml({
    calculation,
    carton,
    companyInfo: companySettings,
    containerPallets: parsed.data.container_pallets,
    pallet,
    productName: parsed.data.product_name,
    sideViewSvg,
    topViewSvg,
  });
  const pdf = await generatePdf(html);

  return { success: true, url: `data:application/pdf;base64,${pdf.toString("base64")}` };
}

export async function getJudyPalletExplanation(payload: {
  productName: string;
  carton: { lengthCm: number; widthCm: number; heightCm: number; weightKg: number; qtyPerCarton: number };
  pallet: { name: string; lengthCm: number; widthCm: number; heightCm: number; maxWeightKg: number };
  forkliftClearanceCm: number;
  calculation: {
    orientation: string;
    cartonsPerLayer: number;
    layerCount: number;
    cartonsPerPallet: number;
    itemsPerPallet: number;
    palletGrossWeightKg: number;
    stackHeightCm: number;
    footprintUsedPct: number;
  };
}): Promise<{ explanation?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  if (!process.env.OPENAI_API_KEY) return { error: "AI not configured" };

  const { buildJudyPalletPrompt } = await import("@/lib/judy-pallet-prompt");
  const prompt = buildJudyPalletPrompt(payload);

  try {
    const completion = await openai.chat.completions.create({
      max_tokens: 1024,
      messages: [
        { content: prompt.system, role: "system" },
        { content: prompt.user, role: "user" },
      ],
      model: "gpt-4o-mini",
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message.content ?? "";
    return { explanation: text };
  } catch {
    return { error: "Failed to reach AI service" };
  }
}

export async function exportCalculatorToProduct(
  productId: string,
  data: {
    carton_length_cm: number;
    carton_width_cm: number;
    carton_height_cm: number;
    carton_weight_kg: number;
    qty_per_carton: number;
  }
): Promise<{ success?: true; error?: string }> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };

  const parsed = z
    .object({
      productId: z.string().uuid(),
      data: z.object({
        carton_height_cm: z.coerce.number().positive(),
        carton_length_cm: z.coerce.number().positive(),
        carton_weight_kg: z.coerce.number().positive(),
        carton_width_cm: z.coerce.number().positive(),
        qty_per_carton: z.coerce.number().positive(),
      }),
    })
    .safeParse({ data, productId });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid carton data" };

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("products")
    .update({
      carton_height_cm: parsed.data.data.carton_height_cm,
      carton_length_cm: parsed.data.data.carton_length_cm,
      carton_weight_kg: parsed.data.data.carton_weight_kg,
      carton_width_cm: parsed.data.data.carton_width_cm,
      packaging_required: true,
      qty_per_carton: parsed.data.data.qty_per_carton,
    })
    .eq("id", parsed.data.productId);

  if (error) return { error: error.message };

  revalidatePath("/products");
  revalidatePath(`/products/${parsed.data.productId}`);
  return { success: true };
}
