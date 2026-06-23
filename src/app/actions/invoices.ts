"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { uploadToOneDrive } from "@/lib/onedrive";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildProFormaHtml } from "@/lib/templates/pro-forma";
import type { ClientInvoice } from "@/types";

type ActionResult = {
  success?: true;
  invoiceId?: string;
  downloadUrl?: string;
  error?: string;
};

type InvoiceKind = "pro_forma" | "deposit" | "final";

const invoiceSchema = z.object({
  invoice_number: z.string().trim().min(1, "Invoice number is required"),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invoice date is required"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be a valid date")
    .nullable(),
  notes: z.string().trim().nullable(),
});

const invoiceStatusSchema = z.enum(["draft", "sent", "paid"]);

async function requireInvoiceManager() {
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

function suffixInvoiceNumber(baseNumber: string, invoiceType: InvoiceKind) {
  if (invoiceType === "deposit") {
    return `${baseNumber}-D`;
  }

  return baseNumber;
}

async function generateClientInvoice(
  tradeId: string,
  formData: FormData,
  invoiceType: InvoiceKind
): Promise<ActionResult> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      tradeId: z.string().uuid(),
      invoice: invoiceSchema,
    })
    .safeParse({
      tradeId,
      invoice: {
        due_date: emptyToNull(formData.get("due_date")),
        invoice_date: formData.get("invoice_date"),
        invoice_number: formData.get("invoice_number"),
        notes: emptyToNull(formData.get("notes")),
      },
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }

  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id, trade_id, client:clients(id, name, address, currency, deposit_pct, final_pct)")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const { data: orderLines, error: orderLinesError } = await supabase
    .from("order_lines")
    .select("id, original_item_name, quantity, unit_price_usd, total_price_usd, sort_order, product:products(id, name_english)")
    .eq("trade_id", tradeId)
    .order("sort_order", { ascending: true });

  if (orderLinesError) {
    return { error: orderLinesError.message };
  }

  if (!orderLines?.length) {
    return { error: "Add order lines before generating an invoice" };
  }

  const client = Array.isArray(trade.client) ? trade.client[0] : trade.client;

  if (!client) {
    return { error: "Trade client not found" };
  }

  const pct =
    invoiceType === "deposit"
      ? Number(client.deposit_pct ?? 50)
      : invoiceType === "final"
        ? Number(client.final_pct ?? 50)
        : 100;
  const percentageMultiplier = pct / 100;
  const invoiceNumber = suffixInvoiceNumber(parsed.data.invoice.invoice_number, invoiceType);
  const suffixLabel =
    invoiceType === "deposit" ? ` (Deposit ${pct}%)` : invoiceType === "final" ? ` (Final ${pct}%)` : "";

  const invoiceLines = orderLines.map((line, index) => {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unit_price_usd);
    const originalTotal = Number(line.total_price_usd ?? quantity * unitPrice);
    const total = invoiceType === "pro_forma" ? originalTotal : roundMoney(originalTotal * percentageMultiplier);
    const dbQuantity = invoiceType === "pro_forma" || unitPrice === 0 ? quantity : total / unitPrice;

    return {
      dbQuantity,
      description: `${line.original_item_name ?? product?.name_english ?? "Item"}${suffixLabel}`,
      orderLineId: line.id,
      quantity,
      sortOrder: Number(line.sort_order ?? index + 1),
      total,
      unitPrice,
    };
  });
  const subtotal = roundMoney(invoiceLines.reduce((sum, line) => sum + line.total, 0));
  const total = subtotal;
  const html = buildProFormaHtml({
    clientAddress: client.address ?? null,
    clientName: client.name,
    currency: client.currency ?? "USD",
    invoiceDate: normalizeDate(parsed.data.invoice.invoice_date),
    invoiceNumber,
    invoiceType,
    lines: invoiceLines,
    notes: parsed.data.invoice.notes,
    subtotal,
    total,
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
      due_date: parsed.data.invoice.due_date,
      invoice_date: parsed.data.invoice.invoice_date,
      invoice_number: invoiceNumber,
      invoice_type: invoiceType,
      notes: parsed.data.invoice.notes,
      pdf_onedrive_url: uploaded.webUrl,
      status: "draft",
      subtotal_usd: subtotal,
      total_usd: total,
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
    document_type: invoiceType,
    file_name: fileName,
    file_size_bytes: pdfBuffer.length,
    notes: parsed.data.invoice.notes,
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

export async function generateProForma(tradeId: string, formData: FormData): Promise<ActionResult> {
  return generateClientInvoice(tradeId, formData, "pro_forma");
}

export async function generateDepositInvoice(tradeId: string, formData: FormData): Promise<ActionResult> {
  return generateClientInvoice(tradeId, formData, "deposit");
}

export async function generateFinalInvoice(tradeId: string, formData: FormData): Promise<ActionResult> {
  return generateClientInvoice(tradeId, formData, "final");
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: ClientInvoice["status"]
): Promise<ActionResult> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      invoiceId: z.string().uuid(),
      status: invoiceStatusSchema,
    })
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
