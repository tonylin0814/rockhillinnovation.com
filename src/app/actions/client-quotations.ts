"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { uploadToOneDrive } from "@/lib/onedrive";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildClientQuotationHtml } from "@/lib/templates/client-quotation";

type ActionResult = {
  success?: true;
  id?: string;
  error?: string;
};

type QuotationLineInput = {
  id?: string;
  product_id: string | null;
  item_description: string | null;
  quantity: number;
  unit_price_usd: number;
  notes: string | null;
};

const quotationSessionSchema = z.object({
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Quote date is required"),
  notes: z.string().trim().nullable(),
});

const quotationLineSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable(),
  item_description: z.string().trim().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit_price_usd: z.coerce.number().min(0, "Unit price must be zero or greater"),
  notes: z.string().trim().nullable(),
});

async function requireQuotationManager() {
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

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

function normalizeDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function loadLogoBase64(): string | null {
  try {
    const logoPath = path.join(process.cwd(), "public", "brand", "rockhill-logo-nav-cropped.png");
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function createQuotationSession(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireQuotationManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      tradeId: z.string().uuid(),
      session: quotationSessionSchema,
    })
    .safeParse({
      tradeId,
      session: {
        quote_date: formData.get("quote_date"),
        notes: emptyToNull(formData.get("notes")),
      },
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quotation session" };
  }

  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id, client_id")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const { data: latestSession, error: latestError } = await supabase
    .from("client_quotation_sessions")
    .select("session_number")
    .eq("trade_id", tradeId)
    .order("session_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    return { error: latestError.message };
  }

  const nextSessionNumber = (latestSession?.session_number ?? 0) + 1;
  const { data, error } = await supabase
    .from("client_quotation_sessions")
    .insert({
      trade_id: tradeId,
      client_id: trade.client_id,
      session_number: nextSessionNumber,
      quote_date: parsed.data.session.quote_date,
      notes: parsed.data.session.notes,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true, id: data.id };
}

export async function updateQuotationSessionStatus(
  sessionId: string,
  status: "draft" | "sent" | "accepted" | "rejected"
): Promise<ActionResult> {
  const access = await requireQuotationManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      status: z.enum(["draft", "sent", "accepted", "rejected"]),
    })
    .safeParse({ sessionId, status });

  if (!parsed.success) {
    return { error: "Invalid quotation session status" };
  }

  const supabase = createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("client_quotation_sessions")
    .select("id, trade_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "Quotation session not found" };
  }

  const { error } = await supabase.from("client_quotation_sessions").update({ status }).eq("id", sessionId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${session.trade_id}`);
  return { success: true };
}

export async function generateQuotationPdf(
  sessionId: string,
  formData: FormData
): Promise<{ success?: true; downloadUrl?: string; error?: string }> {
  const user = await getCurrentUser();

  if (!user || user.role === "partner") {
    return { error: "Access denied" };
  }

  const rawRef = formData.get("quotation_ref");
  const rawValidUntil = formData.get("valid_until");
  const rawNotes = formData.get("notes");

  if (typeof rawRef !== "string" || !rawRef.trim()) {
    return { error: "Quotation reference is required" };
  }

  const quotationRef = rawRef.trim();
  const validUntil =
    typeof rawValidUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValidUntil.trim())
      ? rawValidUntil.trim()
      : null;
  const notes = typeof rawNotes === "string" && rawNotes.trim() ? rawNotes.trim() : null;

  const supabase = createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("client_quotation_sessions")
    .select(
      `id, trade_id, quote_date,
       client:clients(id, name, address, currency),
       lines:client_quotation_lines(
         id, item_description, quantity, unit_price_usd, total_price_usd, notes,
         product:products(id, code, name_english)
       ),
       trade:trades(trade_id)`
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "Quotation session not found" };
  }

  const client = Array.isArray(session.client) ? session.client[0] : session.client;
  const trade = Array.isArray(session.trade) ? session.trade[0] : session.trade;

  if (!client) {
    return { error: "Client not found" };
  }

  const { data: companySettings } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();

  const lines = (Array.isArray(session.lines) ? session.lines : []).map((line) => {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;

    return {
      description: line.item_description ?? product?.name_english ?? "Item",
      itemCode: product?.code ?? null,
      notes: line.notes ?? null,
      quantity: Number(line.quantity),
      total: Number(line.total_price_usd),
      unitPrice: Number(line.unit_price_usd),
    };
  });

  const total = lines.reduce((sum, line) => sum + line.total, 0);
  const logoBase64 = loadLogoBase64();
  const html = buildClientQuotationHtml({
    billToAddress: client.address ?? null,
    billToName: client.name,
    companyInfo: companySettings ?? null,
    currency: client.currency ?? "USD",
    lines,
    logoBase64,
    notes,
    quotationDate: normalizeDate(session.quote_date),
    quotationRef,
    total,
    validUntil: validUntil ? normalizeDate(validUntil) : null,
  });

  const pdfBuffer = await generatePdf(html);
  const fileName = `${quotationRef}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "quotation",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode: trade?.trade_id ?? "unknown",
  });

  const { error: updateError } = await supabase
    .from("client_quotation_sessions")
    .update({ pdf_onedrive_url: uploaded.webUrl, quotation_ref: quotationRef, valid_until: validUntil })
    .eq("id", sessionId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: documentError } = await supabase.from("trade_documents").insert({
    document_category: "client_quotation",
    document_type: "quotation",
    file_name: fileName,
    file_size_bytes: pdfBuffer.length,
    notes,
    onedrive_file_id: uploaded.fileId,
    onedrive_url: uploaded.webUrl,
    related_party: "client",
    status: "draft",
    trade_id: session.trade_id,
    uploaded_by: user.id,
    version: 1,
  });

  if (documentError) {
    return { error: documentError.message };
  }

  revalidatePath(`/trades/${session.trade_id}`);
  return { success: true, downloadUrl: uploaded.webUrl };
}

export async function saveQuotationLines(sessionId: string, lines: QuotationLineInput[]): Promise<ActionResult> {
  const access = await requireQuotationManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      lines: z.array(quotationLineSchema),
    })
    .safeParse({ sessionId, lines });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quotation lines" };
  }

  const supabase = createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("client_quotation_sessions")
    .select("id, trade_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "Quotation session not found" };
  }

  const { data: existingLines, error: existingError } = await supabase
    .from("client_quotation_lines")
    .select("id")
    .eq("session_id", sessionId);

  if (existingError) {
    return { error: existingError.message };
  }

  const incomingIds = new Set(parsed.data.lines.filter((line) => line.id).map((line) => line.id));
  const deleteIds = (existingLines ?? []).map((line) => line.id).filter((id) => !incomingIds.has(id));

  if (deleteIds.length) {
    const { error: deleteError } = await supabase.from("client_quotation_lines").delete().in("id", deleteIds);

    if (deleteError) {
      return { error: deleteError.message };
    }
  }

  const linesToUpdate = parsed.data.lines.filter((line) => line.id);
  const linesToInsert = parsed.data.lines.filter((line) => !line.id);

  for (const line of linesToUpdate) {
    const { id, ...values } = line;
    const { error: updateError } = await supabase
      .from("client_quotation_lines")
      .update({
        product_id: values.product_id,
        item_description: normalizeText(values.item_description),
        quantity: values.quantity,
        unit_price_usd: values.unit_price_usd,
        notes: normalizeText(values.notes),
      })
      .eq("id", id)
      .eq("session_id", sessionId);

    if (updateError) {
      return { error: updateError.message };
    }
  }

  if (linesToInsert.length) {
    const rows = linesToInsert.map((line) => ({
      session_id: sessionId,
      product_id: line.product_id,
      item_description: normalizeText(line.item_description),
      quantity: line.quantity,
      unit_price_usd: line.unit_price_usd,
      notes: normalizeText(line.notes),
    }));

    const { error: insertError } = await supabase.from("client_quotation_lines").insert(rows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath(`/trades/${session.trade_id}`);
  return { success: true };
}
