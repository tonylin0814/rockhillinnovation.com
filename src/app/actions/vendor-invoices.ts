"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { downloadFromOneDrive, uploadToOneDrive } from "@/lib/onedrive";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildVendorInvoiceHtml } from "@/lib/templates/vendor-invoice";

export type ActionResult = { success?: true; error?: string; invoiceId?: string; downloadUrl?: string };

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const invoiceSchema = z.object({
  amount_usd: z.coerce.number().positive("Amount must be greater than zero"),
  description: z.string().trim().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  invoice_number: z.string().trim().optional().nullable(),
  notes: z.string().trim().nullable(),
  shareholder_id: z.string().uuid("Shareholder is required"),
});

async function requireManager() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (user.role === "partner") {
    return { error: "Managers and admins only" };
  }

  return { user };
}

export async function generateVendorInvoice(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({ invoice: invoiceSchema, tradeId: z.string().uuid() })
    .safeParse({
      invoice: {
        amount_usd: formData.get("amount_usd"),
        description: emptyToNull(formData.get("description")),
        invoice_date: formData.get("invoice_date"),
        invoice_number: emptyToNull(formData.get("invoice_number")),
        notes: emptyToNull(formData.get("notes")),
        shareholder_id: formData.get("shareholder_id"),
      },
      tradeId,
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id, trade_id")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const { data: shareholder, error: shareholderError } = await supabase
    .from("trade_shareholders")
    .select("id, person_name, invoices_through_entity, expense_vendor_id")
    .eq("id", parsed.data.invoice.shareholder_id)
    .eq("trade_id", tradeId)
    .maybeSingle();

  if (shareholderError) {
    return { error: shareholderError.message };
  }

  if (!shareholder) {
    return { error: "Shareholder not found on this trade" };
  }

  if (!shareholder.invoices_through_entity || !shareholder.expense_vendor_id) {
    return { error: "This shareholder is not configured to invoice through an entity" };
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("expense_vendors")
    .select("id, name, address, letterhead_onedrive_url")
    .eq("id", shareholder.expense_vendor_id)
    .maybeSingle();

  if (vendorError) {
    return { error: vendorError.message };
  }

  if (!vendor) {
    return { error: "Vendor not found" };
  }

  let letterheadBase64: string | null = null;
  let letterheadMimeType: string | null = null;

  if (vendor.letterhead_onedrive_url) {
    const downloaded = await downloadFromOneDrive(vendor.letterhead_onedrive_url);

    if (downloaded) {
      letterheadBase64 = downloaded.buffer.toString("base64");
      letterheadMimeType = downloaded.mimeType;
    }
  }

  const invoiceNumber = parsed.data.invoice.invoice_number ?? null;
  const html = buildVendorInvoiceHtml({
    amountUsd: parsed.data.invoice.amount_usd,
    billToName: "Rock Hill Innovation",
    description: parsed.data.invoice.description,
    invoiceDate: parsed.data.invoice.invoice_date,
    invoiceNumber,
    letterheadBase64,
    letterheadMimeType,
    notes: parsed.data.invoice.notes,
    vendorAddress: vendor.address ?? null,
    vendorName: vendor.name,
  });
  const pdfBuffer = await generatePdf(html);
  const safeInvoiceNum = invoiceNumber ?? `${vendor.name}-${parsed.data.invoice.invoice_date}`;
  const fileName = `${safeInvoiceNum.replace(/[^\w\-.]/g, "-")}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "invoice",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode: trade.trade_id,
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("expense_vendor_invoices")
    .insert({
      amount_usd: parsed.data.invoice.amount_usd,
      description: parsed.data.invoice.description,
      invoice_date: parsed.data.invoice.invoice_date,
      invoice_number: invoiceNumber,
      notes: parsed.data.invoice.notes,
      pdf_onedrive_url: uploaded.webUrl,
      status: "draft",
      trade_id: tradeId,
      trade_shareholder_id: shareholder.id,
      vendor_id: vendor.id,
    })
    .select("id")
    .single();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  const { error: documentError } = await supabase.from("trade_documents").insert({
    document_category: "invoice",
    document_type: "vendor",
    file_name: fileName,
    file_size_bytes: pdfBuffer.length,
    notes: parsed.data.invoice.notes,
    onedrive_file_id: uploaded.fileId,
    onedrive_url: uploaded.webUrl,
    related_party: "internal",
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

export async function updateVendorInvoiceStatus(
  invoiceId: string,
  status: "draft" | "sent" | "paid"
): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({ invoiceId: z.string().uuid(), status: z.enum(["draft", "sent", "paid"]) })
    .safeParse({ invoiceId, status });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("expense_vendor_invoices")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.invoiceId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
