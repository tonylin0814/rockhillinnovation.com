"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { uploadToOneDrive } from "@/lib/onedrive";
import { generatePackingPlan as runGenerator } from "@/lib/packing-plan-generator";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@/lib/supabase/server";
import type { ContainerType, Product, TradePackingPlan } from "@/types";

export type ActionResult = { success?: true; error?: string; id?: string };

async function requireManager() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  if (user.role === "partner" || user.role === "user") return { error: "Managers and admins only" };
  return { user };
}

function normalizePlan(plan: unknown): TradePackingPlan | null {
  if (!plan || typeof plan !== "object") return null;
  const raw = plan as TradePackingPlan;
  return {
    ...raw,
    pallets: (raw.pallets ?? [])
      .map((pallet) => ({
        ...pallet,
        cases: [...(pallet.cases ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}

async function fetchFullPlan(planId: string): Promise<TradePackingPlan | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("trade_packing_plans")
    .select("*, pallets:trade_packing_pallets(*, cases:trade_packing_cases(*))")
    .eq("id", planId)
    .maybeSingle();
  return normalizePlan(data);
}

export async function generatePackingPlan(
  tradeId: string,
  config: {
    containerType: ContainerType;
    palletLengthCm: number;
    palletWidthCm: number;
    palletHeightCm: number;
    palletMaxWeightKg: number;
    forkliftClearanceCm: number;
  }
): Promise<ActionResult & { planId?: string }> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };

  const parsed = z
    .object({
      containerType: z.enum(["20ft", "40ft", "40hq"]),
      forkliftClearanceCm: z.number().min(0),
      palletHeightCm: z.number().positive(),
      palletLengthCm: z.number().positive(),
      palletMaxWeightKg: z.number().positive(),
      palletWidthCm: z.number().positive(),
      tradeId: z.string().uuid(),
    })
    .safeParse({ ...config, tradeId });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid config" };

  const supabase = createServerSupabaseClient();
  const { data: confirmedSession, error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .select("id")
    .eq("trade_id", tradeId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (sessionError) return { error: sessionError.message };
  if (!confirmedSession) {
    return { error: "No confirmed supplier quote found. Confirm a quote session before generating a packing plan." };
  }

  const { data: quoteLines, error: quoteLinesError } = await supabase
    .from("supplier_quote_lines")
    .select(
      "quantity, product:products(id, code, name_english, qty_per_carton, carton_weight_kg, carton_length_cm, carton_width_cm, carton_height_cm)"
    )
    .eq("session_id", confirmedSession.id)
    .not("product_id", "is", null);

  if (quoteLinesError) return { error: quoteLinesError.message };
  if (!quoteLines?.length) return { error: "No product lines found in the confirmed supplier quote." };

  const lines = quoteLines
    .map((quoteLine) => {
      const product = Array.isArray(quoteLine.product) ? quoteLine.product[0] : quoteLine.product;
      if (!product) return null;
      return {
        carton_height_cm: Number(product.carton_height_cm ?? 0),
        carton_length_cm: Number(product.carton_length_cm ?? 0),
        carton_weight_kg: Number(product.carton_weight_kg ?? 0),
        carton_width_cm: Number(product.carton_width_cm ?? 0),
        product_code: product.code,
        product_id: product.id,
        product_name: product.name_english ?? product.code,
        qty_per_carton: Number(product.qty_per_carton ?? 0),
        quantity: Number(quoteLine.quantity),
      };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  if (!lines.length) return { error: "No products found in the confirmed supplier quote." };

  const generated = runGenerator(
    lines,
    {
      height_cm: parsed.data.palletHeightCm,
      length_cm: parsed.data.palletLengthCm,
      max_weight_kg: parsed.data.palletMaxWeightKg,
      width_cm: parsed.data.palletWidthCm,
    },
    parsed.data.containerType,
    parsed.data.forkliftClearanceCm
  );

  if (!generated.total_cases) {
    return {
      error:
        generated.warnings.length > 0
          ? `No packable cartons found. ${generated.warnings.join(" ")}`
          : "No packable cartons found.",
    };
  }

  const admin = createServerSupabaseAdmin();
  await admin.from("trade_packing_plans").delete().eq("trade_id", tradeId);
  const { data: plan, error: planError } = await admin
    .from("trade_packing_plans")
    .insert({
      container_type: parsed.data.containerType,
      forklift_clearance_cm: parsed.data.forkliftClearanceCm,
      pallet_height_cm: parsed.data.palletHeightCm,
      pallet_length_cm: parsed.data.palletLengthCm,
      pallet_max_weight_kg: parsed.data.palletMaxWeightKg,
      pallet_width_cm: parsed.data.palletWidthCm,
      status: "draft",
      trade_id: tradeId,
    })
    .select("id")
    .single();

  if (planError) return { error: planError.message };

  for (let index = 0; index < generated.pallets.length; index += 1) {
    const generatedPallet = generated.pallets[index];
    const { data: pallet, error: palletError } = await admin
      .from("trade_packing_pallets")
      .insert({
        is_mixed: generatedPallet.is_mixed,
        pallet_label: generatedPallet.pallet_label,
        pallet_number: generatedPallet.pallet_number,
        plan_id: plan.id,
        sort_order: index,
        total_cases: generatedPallet.total_cases,
        total_weight_kg: generatedPallet.total_weight_kg,
      })
      .select("id")
      .single();

    if (palletError) return { error: palletError.message };

    if (generatedPallet.cases.length) {
      const { error: caseError } = await admin.from("trade_packing_cases").insert(
        generatedPallet.cases.map((item, caseIndex) => ({
          case_label: item.case_label,
          case_number: item.case_number,
          pallet_id: pallet.id,
          plan_id: plan.id,
          product_code: item.product_code,
          product_id: item.product_id,
          product_name: item.product_name,
          qty_in_case: item.qty_in_case,
          sort_order: caseIndex,
          weight_kg: item.weight_kg,
        }))
      );
      if (caseError) return { error: caseError.message };
    }
  }

  await logActivity({
    action: "created",
    summary: `Packing plan generated: ${generated.total_pallets} pallets, ${generated.total_cases} cases`,
    targetId: plan.id,
    targetTable: "trade_packing_plans",
    tradeId,
    user: access.user,
  });

  revalidatePath(`/trades/${tradeId}`);
  return { success: true, planId: plan.id };
}

export async function confirmPackingPlan(planId: string, tradeId: string): Promise<ActionResult> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("trade_packing_plans")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("trade_id", tradeId);
  if (error) return { error: error.message };
  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function unlockPackingPlan(planId: string, tradeId: string): Promise<ActionResult> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("trade_packing_plans")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("trade_id", tradeId);
  if (error) return { error: error.message };
  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function deletePackingPlan(tradeId: string): Promise<ActionResult> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("trade_packing_plans").delete().eq("trade_id", tradeId);
  if (error) return { error: error.message };
  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function moveCaseToPallet(caseId: string, targetPalletId: string, tradeId: string): Promise<ActionResult> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };
  const admin = createServerSupabaseAdmin();
  const { data: caseRow, error: fetchError } = await admin
    .from("trade_packing_cases")
    .select("plan_id")
    .eq("id", caseId)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!caseRow) return { error: "Case not found" };

  const { data: targetPallet, error: targetPalletError } = await admin
    .from("trade_packing_pallets")
    .select("plan_id")
    .eq("id", targetPalletId)
    .maybeSingle();

  if (targetPalletError) return { error: targetPalletError.message };
  if (!targetPallet || targetPallet.plan_id !== caseRow.plan_id) {
    return { error: "Target pallet does not belong to this packing plan" };
  }

  const { error } = await admin.from("trade_packing_cases").update({ pallet_id: targetPalletId }).eq("id", caseId);
  if (error) return { error: error.message };

  const [{ data: planPallets }, { data: allCases }] = await Promise.all([
    admin.from("trade_packing_pallets").select("id").eq("plan_id", caseRow.plan_id),
    admin.from("trade_packing_cases").select("pallet_id, weight_kg, product_id").eq("plan_id", caseRow.plan_id),
  ]);
  const totals = new Map<string, { cases: number; productIds: Set<string>; weight: number }>();

  for (const pallet of planPallets ?? []) {
    totals.set(pallet.id, { cases: 0, productIds: new Set<string>(), weight: 0 });
  }

  for (const item of allCases ?? []) {
    const current = totals.get(item.pallet_id) ?? { cases: 0, productIds: new Set<string>(), weight: 0 };
    current.cases += 1;
    current.weight += Number(item.weight_kg);
    current.productIds.add(item.product_id);
    totals.set(item.pallet_id, current);
  }

  for (const [palletId, total] of Array.from(totals.entries())) {
    await admin
      .from("trade_packing_pallets")
      .update({
        is_mixed: total.productIds.size > 1,
        total_cases: total.cases,
        total_weight_kg: Math.round(total.weight * 1000) / 1000,
      })
      .eq("id", palletId);
    }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

async function getTradeAndCompany(tradeId: string) {
  const supabase = createServerSupabaseClient();
  const [{ data: trade }, { data: companySettings }] = await Promise.all([
    supabase.from("trades").select("trade_id, client:clients(name)").eq("id", tradeId).maybeSingle(),
    supabase.from("company_settings").select("*").limit(1).maybeSingle(),
  ]);
  const client = Array.isArray(trade?.client) ? trade.client[0] : trade?.client;
  return { clientName: client?.name ?? "Unknown", companySettings: companySettings ?? null, tradeCode: trade?.trade_id ?? "unknown" };
}

export async function generatePackingListPdf(
  planId: string,
  tradeId: string
): Promise<ActionResult & { downloadUrl?: string }> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };
  const plan = await fetchFullPlan(planId);
  if (!plan) return { error: "Plan not found" };
  const { clientName, companySettings, tradeCode } = await getTradeAndCompany(tradeId);
  const { buildPackingListHtml } = await import("@/lib/templates/packing-list");
  const pdfBuffer = await generatePdf(buildPackingListHtml(plan, tradeCode, clientName, companySettings));
  const fileName = `packing-list-${tradeCode}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "packing",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode,
  });
  return { success: true, downloadUrl: uploaded.webUrl };
}

export async function generateStackingInstructionsPdf(
  planId: string,
  tradeId: string
): Promise<ActionResult & { downloadUrl?: string }> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };
  const plan = await fetchFullPlan(planId);
  if (!plan) return { error: "Plan not found" };
  const { companySettings, tradeCode } = await getTradeAndCompany(tradeId);
  const { buildStackingInstructionsHtml } = await import("@/lib/templates/stacking-instructions");
  const pdfBuffer = await generatePdf(buildStackingInstructionsHtml(plan, companySettings));
  const fileName = `stacking-instructions-${tradeCode}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "packing",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode,
  });
  return { success: true, downloadUrl: uploaded.webUrl };
}

export async function generateBatchCartonLabelsPdf(
  planId: string,
  tradeId: string
): Promise<ActionResult & { downloadUrl?: string }> {
  const access = await requireManager();
  if ("error" in access) return { error: access.error };
  const plan = await fetchFullPlan(planId);
  if (!plan) return { error: "Plan not found" };
  const productIds = Array.from(new Set(plan.pallets.flatMap((pallet) => pallet.cases.map((item) => item.product_id))));
  const supabase = createServerSupabaseClient();
  const { data: products } = await supabase.from("products").select("*, supplier:suppliers(id, name, code)").in("id", productIds);
  const { tradeCode } = await getTradeAndCompany(tradeId);
  const { buildCartonLabelHtml } = await import("@/lib/templates/carton-label");
  const counts = new Map<string, number>();
  for (const item of plan.pallets.flatMap((pallet) => pallet.cases)) {
    counts.set(item.product_id, (counts.get(item.product_id) ?? 0) + 1);
  }
  const labelBodies = ((products ?? []) as Product[]).map((product) =>
    buildCartonLabelHtml({ product, totalCartons: counts.get(product.id) ?? 1 })
      .replace(/<!doctype html>[\s\S]*?<body>/i, "")
      .replace(/<\/body>[\s\S]*?<\/html>/i, "")
  );
  const html = `<!doctype html><html><head><style>@page{size:210mm 148mm;margin:0}body{margin:0}.page-break{page-break-after:always}</style></head><body>${labelBodies
    .map((body, index) => `<div${index < labelBodies.length - 1 ? ' class="page-break"' : ""}>${body}</div>`)
    .join("")}</body></html>`;
  const pdfBuffer = await generatePdf(html);
  const fileName = `carton-labels-${tradeCode}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "packing",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode,
  });
  return { success: true, downloadUrl: uploaded.webUrl };
}
