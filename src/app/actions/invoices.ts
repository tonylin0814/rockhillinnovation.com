"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { uploadToOneDrive } from "@/lib/onedrive";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildProFormaHtml } from "@/lib/templates/pro-forma";
import type { ClientInvoice, InvoiceAdjustmentLine } from "@/types";

type ActionResult = {
  success?: true;
  invoiceId?: string;
  downloadUrl?: string;
  error?: string;
};

const invoiceStatusSchema = z.enum(["draft", "sent", "paid"]);

async function requireInvoiceManager() {
  const user = await getCurrentUser();

  if (!user || user.role === "partner") {
    return { error: "Access denied" };
  }

  return { user };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseAdjustmentLines(formData: FormData): InvoiceAdjustmentLine[] {
  const raw = formData.get("adjustment_lines_json");

  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (adjustment): adjustment is InvoiceAdjustmentLine =>
        typeof adjustment === "object" &&
        adjustment !== null &&
        typeof adjustment.description === "string" &&
        typeof adjustment.amount_usd === "number"
    );
  } catch {
    return [];
  }
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

export async function generateCommercialInvoice(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const invoiceNumber = emptyToNull(formData.get("invoice_number"));
  const invoiceDate = emptyToNull(formData.get("invoice_date"));
  const depositDueDateRaw = emptyToNull(formData.get("deposit_due_date"));
  const depositPctRaw = formData.get("deposit_pct");
  const paymentTerms = emptyToNull(formData.get("payment_terms"));
  const notes = emptyToNull(formData.get("notes"));

  if (!invoiceNumber) {
    return { error: "Invoice number is required" };
  }

  if (!invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
    return { error: "Invoice date is required" };
  }

  const depositPct = Math.min(100, Math.max(0, Number(depositPctRaw) || 50));
  const depositDueDate =
    depositDueDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(depositDueDateRaw) ? depositDueDateRaw : null;
  const adjustmentLines = parseAdjustmentLines(formData);
  const logoBase64 = loadLogoBase64();

  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select(
      `id, trade_id,
       client:clients(id, name, address, currency, shipping_address),
       order_lines(id, original_item_name, quantity, unit_price_usd, total_price_usd, sort_order,
                   product:products(id, code, name_english))`
    )
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const client = Array.isArray(trade.client) ? trade.client[0] : trade.client;

  if (!client) {
    return { error: "No client linked to this trade" };
  }

  const rawLines = Array.isArray(trade.order_lines) ? trade.order_lines : [];
  const invoiceLines = rawLines
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((line) => {
      const product = Array.isArray(line.product) ? line.product[0] : line.product;
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unit_price_usd);
      const total = roundMoney(quantity * unitPrice);

      return {
        dbQuantity: quantity,
        description: line.original_item_name ?? product?.name_english ?? "Item",
        itemCode: product?.code ?? null,
        orderLineId: line.id,
        quantity,
        sortOrder: Number(line.sort_order ?? 0),
        total,
        unitPrice,
      };
    });

  if (!invoiceLines.length) {
    return { error: "Add order lines before generating an invoice" };
  }

  const subtotal = roundMoney(invoiceLines.reduce((sum, line) => sum + line.total, 0));
  const adjustmentsTotal = adjustmentLines.reduce((sum, adjustment) => sum + adjustment.amount_usd, 0);
  const totalUsd = roundMoney(subtotal + adjustmentsTotal);

  const html = buildProFormaHtml({
    adjustmentLines,
    billToAddress: client.address ?? null,
    billToName: client.name,
    currency: client.currency ?? "USD",
    depositDueDate: depositDueDate ? normalizeDate(depositDueDate) : null,
    depositPct,
    invoiceDate: normalizeDate(invoiceDate),
    invoiceNumber,
    lines: invoiceLines,
    logoBase64,
    notes,
    paymentTerms,
    shipToAddress: client.shipping_address ?? null,
    shipToName: client.name,
    subtotal,
  });

  const pdfBuffer = await generatePdf(html);
  const fileName = `${invoiceNumber}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "invoice",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode: trade.trade_id,
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoices")
    .insert({
      adjustment_lines: adjustmentLines,
      deposit_pct: depositPct,
      due_date: depositDueDate,
      invoice_date: invoiceDate,
      invoice_number: invoiceNumber,
      invoice_type: "commercial",
      notes,
      payment_terms: paymentTerms,
      pdf_onedrive_url: uploaded.webUrl,
      status: "draft",
      subtotal_usd: subtotal,
      total_usd: totalUsd,
      trade_id: tradeId,
    })
    .select("id")
    .single();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  const { error: linesError } = await supabase.from("client_invoice_lines").insert(
    invoiceLines.map((line) => ({
      description: line.description,
      invoice_id: invoice.id,
      order_line_id: line.orderLineId,
      quantity: line.dbQuantity,
      sort_order: line.sortOrder,
      unit_price_usd: line.unitPrice,
    }))
  );

  if (linesError) {
    return { error: linesError.message };
  }

  const { error: documentError } = await supabase.from("trade_documents").insert({
    document_category: "invoice",
    document_type: "commercial",
    file_name: fileName,
    file_size_bytes: pdfBuffer.length,
    notes,
    onedrive_file_id: uploaded.fileId,
    onedrive_url: uploaded.webUrl,
    related_party: "client",
    status: "draft",
    trade_id: tradeId,
    uploaded_by: access.user.id,
    version: 1,
  });

  if (documentError) {
    return { error: documentError.message };
  }

  revalidatePath(`/trades/${tradeId}`);
  return { success: true, downloadUrl: uploaded.webUrl, invoiceId: invoice.id };
}

export const generateProForma = (tradeId: string, formData: FormData) =>
  generateCommercialInvoice(tradeId, formData);

export const generateDepositInvoice = (tradeId: string, formData: FormData) =>
  generateCommercialInvoice(tradeId, formData);

export const generateFinalInvoice = (tradeId: string, formData: FormData) =>
  generateCommercialInvoice(tradeId, formData);

export async function updateInvoiceStatus(
  invoiceId: string,
  status: ClientInvoice["status"]
): Promise<ActionResult> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({ invoiceId: z.string().uuid(), status: invoiceStatusSchema })
    .safeParse({ invoiceId, status });

  if (!parsed.success) {
    return { error: "Invalid invoice status" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoices")
    .select("id, trade_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  const { error } = await supabase.from("client_invoices").update({ status }).eq("id", invoiceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${invoice.trade_id}`);
  return { success: true };
}
