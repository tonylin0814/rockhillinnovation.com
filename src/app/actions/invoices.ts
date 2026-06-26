"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { notifyParticipants } from "@/lib/notifications";
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

type InvoicePdfProduct = {
  code: string | null;
  components?:
    | {
        quantity_per_set: number | string;
        component:
          | {
              code: string | null;
              name_english: string | null;
            }
          | {
              code: string | null;
              name_english: string | null;
            }[]
          | null;
      }[]
    | null;
  id: string;
  name_english: string | null;
  product_type: "part" | "set";
};

const invoiceStatusSchema = z.enum(["draft", "sent", "paid"]);

async function requireInvoiceManager() {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  return access;
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
       client:clients(id, name, address, currency, shipping_address)`
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

  const { data: existingInvoice, error: existingInvoiceError } = await supabase
    .from("client_invoices")
    .select("id")
    .eq("invoice_number", invoiceNumber)
    .maybeSingle();

  if (existingInvoiceError) {
    return { error: existingInvoiceError.message };
  }

  if (existingInvoice) {
    return {
      error: `Invoice ${invoiceNumber} already exists. Use the existing invoice in the Invoices list, or delete it before regenerating.`,
    };
  }

  const [{ data: companySettings }, { data: bankingAccounts }, { data: quotationSession, error: quotationError }] =
    await Promise.all([
      supabase.from("company_settings").select("*").limit(1).maybeSingle(),
      supabase.from("company_banking_accounts").select("*").eq("is_active", true).order("sort_order").limit(1),
      supabase
        .from("client_quotation_sessions")
        .select(
          `id, session_number,
           client_quotation_lines(id, item_description, quantity, unit_price_usd,
                                  product:products(
                                    id, code, name_english, product_type,
                                    components:product_components!product_components_set_product_id_fkey(
                                      quantity_per_set,
                                      component:products!product_components_component_product_id_fkey(code, name_english)
                                    )
                                  ))`
        )
        .eq("trade_id", tradeId)
        .in("status", ["accepted", "sent"])
        .order("session_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (quotationError) {
    return { error: quotationError.message };
  }

  const bankingAccount = Array.isArray(bankingAccounts) ? (bankingAccounts[0] ?? null) : (bankingAccounts ?? null);

  const rawLines = Array.isArray(quotationSession?.client_quotation_lines)
    ? quotationSession.client_quotation_lines
    : [];
  const invoiceLines = rawLines.map((line, index) => {
    const product = (Array.isArray(line.product) ? line.product[0] : line.product) as InvoicePdfProduct | null;
    const components =
      product?.product_type === "set"
        ? (product.components ?? [])
            .map((componentRow) => {
              const component = Array.isArray(componentRow.component)
                ? componentRow.component[0]
                : componentRow.component;

              if (!component?.name_english) {
                return null;
              }

              return {
                code: component.code ?? null,
                name: component.name_english,
                quantityPerSet: Number(componentRow.quantity_per_set),
              };
            })
            .filter((component): component is { code: string | null; name: string; quantityPerSet: number } => Boolean(component))
        : [];
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unit_price_usd);
    const total = roundMoney(quantity * unitPrice);

    return {
      components,
      dbQuantity: quantity,
      description: line.item_description ?? product?.name_english ?? "Item",
      itemCode: product?.code ?? null,
      quantity,
      sortOrder: index,
      total,
      unitPrice,
    };
  });

  if (!invoiceLines.length) {
    return {
      error:
        "No accepted or sent client quotation found for this trade. Please create and accept a client quotation first.",
    };
  }

  const subtotal = roundMoney(invoiceLines.reduce((sum, line) => sum + line.total, 0));
  const adjustmentsTotal = adjustmentLines.reduce((sum, adjustment) => sum + adjustment.amount_usd, 0);
  const totalUsd = roundMoney(subtotal + adjustmentsTotal);

  const html = buildProFormaHtml({
    adjustmentLines,
    bankingAccount,
    billToAddress: client.address ?? null,
    billToName: client.name,
    companyInfo: companySettings ?? null,
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
    if (invoiceError.code === "23505") {
      return {
        error: `Invoice ${invoiceNumber} already exists. Use the existing invoice in the Invoices list, or delete it before regenerating.`,
      };
    }

    return { error: invoiceError.message };
  }

  const { error: linesError } = await supabase.from("client_invoice_lines").insert(
    invoiceLines.map((line) => ({
      description: line.description,
      invoice_id: invoice.id,
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

  await notifyParticipants(
    tradeId,
    trade.trade_id,
    access.user.id,
    access.user.name,
    `A commercial invoice was generated for trade ${trade.trade_id}.`
  );
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

export async function deleteClientInvoice(invoiceId: string): Promise<ActionResult> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.object({ invoiceId: z.string().uuid() }).safeParse({ invoiceId });

  if (!parsed.success) {
    return { error: "Invalid invoice" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoices")
    .select("id, invoice_number, trade_id, trade:trades(trade_id)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  const { error: linesError } = await supabase.from("client_invoice_lines").delete().eq("invoice_id", invoiceId);

  if (linesError) {
    return { error: linesError.message };
  }

  const { error: deleteError } = await supabase.from("client_invoices").delete().eq("id", invoiceId);

  if (deleteError) {
    if (deleteError.code === "23503") {
      return { error: "This invoice is linked to another record and cannot be deleted yet." };
    }

    return { error: deleteError.message };
  }

  const trade = Array.isArray(invoice.trade) ? invoice.trade[0] : invoice.trade;

  await notifyParticipants(
    invoice.trade_id,
    trade?.trade_id ?? "trade",
    access.user.id,
    access.user.name,
    `Invoice ${invoice.invoice_number} was deleted.`
  );

  revalidatePath(`/trades/${invoice.trade_id}`);
  return { success: true };
}
