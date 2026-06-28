"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager as requireManagerRole } from "@/lib/auth";
import { getNextTradeDocumentVersion } from "@/lib/document-version";
import { notifyParticipants } from "@/lib/notifications";
import { deleteFromOneDrive, downloadFromOneDrive, uploadToOneDrive } from "@/lib/onedrive";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildVendorInvoiceHtml } from "@/lib/templates/vendor-invoice";
import { buildVendorOutgoingInvoiceHtml } from "@/lib/templates/vendor-invoices/dispatcher";

export type ActionResult = { success?: true; error?: string; invoiceId?: string; downloadUrl?: string };
type StoredVendorInvoiceLine = {
  amount_usd: number | string;
  description: string;
};

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

const outgoingLineSchema = z.object({
  description: z.string().trim().min(1, "Description required"),
  amount_usd: z.coerce.number().positive("Amount must be positive"),
});

const outgoingInvoiceSchema = z.object({
  vendor_id: z.string().uuid("Vendor is required"),
  invoice_number: z.string().trim().optional().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  notes: z.string().trim().nullable(),
  lines: z.array(outgoingLineSchema).min(1, "At least one line item required"),
});

async function requireManager() {
  const access = await requireManagerRole();

  if ("error" in access) {
    return { error: access.error };
  }

  return access;
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
  const safeInvoiceNum = `${vendor.name} - ${invoiceNumber ?? parsed.data.invoice.invoice_date}`;
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

  const nextDocumentVersion = await getNextTradeDocumentVersion({
    category: "invoice",
    supabase,
    tradeId,
  });

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
    version: nextDocumentVersion,
  });

  if (documentError) {
    return { error: documentError.message };
  }

  await notifyParticipants(
    tradeId,
    trade.trade_id,
    access.user.id,
    access.user.name,
    `A vendor invoice was generated for trade ${trade.trade_id}.`
  );
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
  const { data: invoice, error } = await supabase
    .from("expense_vendor_invoices")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.invoiceId)
    .select("trade_id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  revalidatePath(`/trades/${invoice.trade_id}`);
  return { success: true };
}

function parseOutgoingLines(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return JSON.parse(value);
}

function parseEditableVendorInvoiceLines(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    const result = z.array(outgoingLineSchema).min(1, "At least one line item required").safeParse(parsed);

    if (!result.success) {
      return { error: result.error.issues[0]?.message ?? "Invalid vendor invoice lines" };
    }

    return { lines: result.data };
  } catch {
    return { error: "Vendor invoice lines must be valid JSON" };
  }
}

function invoiceStatusToDocumentStatus(status: string): "approved" | "draft" | "sent" {
  if (status === "paid") return "approved";
  if (status === "sent") return "sent";
  return "draft";
}

function buildCompanyAddress(company: {
  address_line1?: string | null;
  address_line2?: string | null;
  city_state?: string | null;
  country?: string | null;
} | null) {
  return [
    company?.address_line1,
    company?.address_line2,
    company?.city_state,
    company?.country,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateVendorOutgoingInvoice(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  let rawLines;

  try {
    rawLines = parseOutgoingLines(formData.get("lines"));
  } catch {
    return { error: "Line items must be valid JSON" };
  }

  const parsed = z
    .object({ invoice: outgoingInvoiceSchema, tradeId: z.string().uuid() })
    .safeParse({
      invoice: {
        vendor_id: formData.get("vendor_id"),
        invoice_number: emptyToNull(formData.get("invoice_number")),
        invoice_date: formData.get("invoice_date"),
        notes: emptyToNull(formData.get("notes")),
        lines: rawLines,
      },
      tradeId,
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createServerSupabaseClient();
  const [{ data: trade, error: tradeError }, { data: vendor, error: vendorError }, { data: companySettings }] =
    await Promise.all([
      supabase.from("trades").select("id, trade_id").eq("id", tradeId).maybeSingle(),
      supabase
        .from("expense_vendors")
        .select(
          "id, code, name, address, status, bank_account_name, bank_account_number, bank_name, bank_address, bank_swift_code, bank_aba_routing, bank_institution_no, bank_transit_no, bank_tel, bank_currency, banking_instructions"
        )
        .eq("id", parsed.data.invoice.vendor_id)
        .maybeSingle(),
      supabase
        .from("company_settings")
        .select("company_name_full, company_name, address_line1, address_line2, city_state, country")
        .limit(1)
        .maybeSingle(),
    ]);

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (vendorError) {
    return { error: vendorError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  if (!vendor) {
    return { error: "Vendor not found" };
  }

  if (vendor.status !== "active") {
    return { error: "Vendor is inactive" };
  }

  const totalUsd = parsed.data.invoice.lines.reduce((sum, line) => sum + Number(line.amount_usd), 0);
  const invoiceNumber = parsed.data.invoice.invoice_number ?? null;
  const billToName =
    companySettings?.company_name_full ?? companySettings?.company_name ?? "Rock Hill Innovation Co., Ltd";
  const html = buildVendorOutgoingInvoiceHtml({
    billToAddress: buildCompanyAddress(companySettings),
    billToName,
    invoiceDate: parsed.data.invoice.invoice_date,
    invoiceNumber,
    lines: parsed.data.invoice.lines.map((line) => ({
      amountUsd: Number(line.amount_usd),
      description: line.description,
    })),
    notes: parsed.data.invoice.notes,
    totalUsd,
    vendorAddress: vendor.address ?? null,
    vendorBanking: {
      abaRouting: vendor.bank_aba_routing ?? null,
      accountName: vendor.bank_account_name ?? null,
      accountNumber: vendor.bank_account_number ?? null,
      bankAddress: vendor.bank_address ?? null,
      bankName: vendor.bank_name ?? null,
      bankTel: vendor.bank_tel ?? null,
      bankingInstructions: vendor.banking_instructions ?? null,
      currency: vendor.bank_currency ?? null,
      institutionNo: vendor.bank_institution_no ?? null,
      swiftCode: vendor.bank_swift_code ?? null,
      transitNo: vendor.bank_transit_no ?? null,
    },
    vendorCode: vendor.code,
    vendorName: vendor.name,
  });

  const pdfBuffer = await generatePdf(html);
  const safeInvoiceNum = `${vendor.name} - ${invoiceNumber ?? parsed.data.invoice.invoice_date}`;
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
      amount_usd: totalUsd,
      description: null,
      invoice_date: parsed.data.invoice.invoice_date,
      invoice_number: invoiceNumber,
      lines: parsed.data.invoice.lines,
      notes: parsed.data.invoice.notes,
      pdf_onedrive_url: uploaded.webUrl,
      status: "draft",
      trade_id: tradeId,
      trade_shareholder_id: null,
      vendor_id: vendor.id,
    })
    .select("id")
    .single();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  const nextDocumentVersion = await getNextTradeDocumentVersion({
    category: "invoice",
    supabase,
    tradeId,
  });

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
    version: nextDocumentVersion,
  });

  if (documentError) {
    return { error: documentError.message };
  }

  await notifyParticipants(
    tradeId,
    trade.trade_id,
    access.user.id,
    access.user.name,
    `A vendor invoice was generated for trade ${trade.trade_id}.`
  );
  revalidatePath(`/trades/${tradeId}`);
  return { success: true, downloadUrl: uploaded.webUrl, invoiceId: invoice.id };
}

export async function updateVendorOutgoingInvoice(invoiceId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      invoiceId: z.string().uuid(),
      invoice_number: z.string().trim().transform((value) => (value.length ? value : null)).nullable(),
      invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
      notes: z.string().trim().transform((value) => (value.length ? value : null)).nullable(),
      status: z.enum(["draft", "sent", "paid"]),
    })
    .safeParse({
      invoiceId,
      invoice_number: formData.get("invoice_number"),
      invoice_date: formData.get("invoice_date"),
      notes: formData.get("notes"),
      status: formData.get("status"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("expense_vendor_invoices")
    .select("id, trade_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  const parsedLines = parseEditableVendorInvoiceLines(formData.get("lines"));

  if (parsedLines?.error) {
    return { error: parsedLines.error };
  }

  const invoiceLines = parsedLines?.lines ?? null;
  const updatePayload: Record<string, unknown> = {
    invoice_date: parsed.data.invoice_date,
    invoice_number: parsed.data.invoice_number,
    notes: parsed.data.notes,
    status: parsed.data.status,
  };

  if (invoiceLines) {
    updatePayload.lines = invoiceLines;
    updatePayload.amount_usd = invoiceLines.reduce((sum, line) => sum + Number(line.amount_usd), 0);
  }

  const { error } = await supabase
    .from("expense_vendor_invoices")
    .update(updatePayload)
    .eq("id", invoiceId);

  if (error) {
    return { error: error.message };
  }

  if (invoice.trade_id) {
    revalidatePath(`/trades/${invoice.trade_id}`);
  }

  return { success: true };
}

export async function regenerateVendorOutgoingInvoicePdf(invoiceId: string): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.string().uuid().safeParse(invoiceId);

  if (!parsed.success) {
    return { error: "Invalid invoice" };
  }

  const supabase = createServerSupabaseClient();
  const [{ data: invoice, error: invoiceError }, { data: companySettings }] = await Promise.all([
    supabase
      .from("expense_vendor_invoices")
      .select(
        `*,
         trade:trades(id, trade_id),
         vendor:expense_vendors(
           id, code, name, address,
           bank_account_name, bank_account_number, bank_name, bank_address,
           bank_swift_code, bank_aba_routing, bank_institution_no, bank_transit_no,
           bank_tel, bank_currency, banking_instructions
         )`
      )
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase
      .from("company_settings")
      .select("company_name_full, company_name, address_line1, address_line2, city_state, country")
      .limit(1)
      .maybeSingle(),
  ]);

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  const trade = Array.isArray(invoice.trade) ? invoice.trade[0] : invoice.trade;
  const vendor = Array.isArray(invoice.vendor) ? invoice.vendor[0] : invoice.vendor;

  if (!trade) {
    return { error: "Trade not found" };
  }

  if (!vendor) {
    return { error: "Vendor not found" };
  }

  const storedLines = (Array.isArray(invoice.lines) ? invoice.lines : []) as StoredVendorInvoiceLine[];
  const lines = storedLines.length
    ? storedLines.map((line) => ({
        amountUsd: Number(line.amount_usd),
        description: line.description,
      }))
    : [{ amountUsd: Number(invoice.amount_usd), description: invoice.description ?? "Service" }];

  if (!lines.length) {
    return { error: "Invoice has no detail lines to regenerate." };
  }

  const totalUsd = lines.reduce((sum, line) => sum + Number(line.amountUsd), 0);
  const billToName =
    companySettings?.company_name_full ?? companySettings?.company_name ?? "Rock Hill Innovation Co., Ltd";
  const html = buildVendorOutgoingInvoiceHtml({
    billToAddress: buildCompanyAddress(companySettings),
    billToName,
    invoiceDate: invoice.invoice_date,
    invoiceNumber: invoice.invoice_number,
    lines,
    notes: invoice.notes ?? null,
    totalUsd,
    vendorAddress: vendor.address ?? null,
    vendorBanking: {
      abaRouting: vendor.bank_aba_routing ?? null,
      accountName: vendor.bank_account_name ?? null,
      accountNumber: vendor.bank_account_number ?? null,
      bankAddress: vendor.bank_address ?? null,
      bankName: vendor.bank_name ?? null,
      bankTel: vendor.bank_tel ?? null,
      bankingInstructions: vendor.banking_instructions ?? null,
      currency: vendor.bank_currency ?? null,
      institutionNo: vendor.bank_institution_no ?? null,
      swiftCode: vendor.bank_swift_code ?? null,
      transitNo: vendor.bank_transit_no ?? null,
    },
    vendorCode: vendor.code,
    vendorName: vendor.name,
  });
  const pdfBuffer = await generatePdf(html);
  const safeInvoiceNum = `${vendor.name} - ${invoice.invoice_number ?? invoice.invoice_date}`;
  const fileName = `${safeInvoiceNum.replace(/[^\w\-.]/g, "-")}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "invoice",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode: trade.trade_id,
  });

  if (invoice.pdf_onedrive_url) {
    const { data: oldDocument, error: oldDocumentError } = await supabase
      .from("trade_documents")
      .select("id, onedrive_file_id")
      .eq("onedrive_url", invoice.pdf_onedrive_url)
      .maybeSingle();

    if (oldDocumentError) {
      return { error: oldDocumentError.message };
    }

    if (oldDocument?.onedrive_file_id && oldDocument.onedrive_file_id !== uploaded.fileId) {
      await deleteFromOneDrive(oldDocument.onedrive_file_id);
    }

    if (oldDocument?.id) {
      const { error: deleteDocumentError } = await supabase.from("trade_documents").delete().eq("id", oldDocument.id);

      if (deleteDocumentError) {
        return { error: deleteDocumentError.message };
      }
    }
  }

  const { error: updateError } = await supabase
    .from("expense_vendor_invoices")
    .update({ amount_usd: totalUsd, pdf_onedrive_url: uploaded.webUrl })
    .eq("id", invoiceId);

  if (updateError) {
    return { error: updateError.message };
  }

  const nextDocumentVersion = await getNextTradeDocumentVersion({
    category: "invoice",
    supabase,
    tradeId: invoice.trade_id,
  });

  const { error: documentError } = await supabase.from("trade_documents").insert({
    document_category: "invoice",
    document_type: "vendor",
    file_name: fileName,
    file_size_bytes: pdfBuffer.length,
    notes: invoice.notes ?? null,
    onedrive_file_id: uploaded.fileId,
    onedrive_url: uploaded.webUrl,
    related_party: "internal",
    status: invoiceStatusToDocumentStatus(invoice.status),
    trade_id: invoice.trade_id,
    uploaded_by: access.user.id,
    version: nextDocumentVersion,
  });

  if (documentError) {
    return { error: documentError.message };
  }

  revalidatePath(`/trades/${invoice.trade_id}`);
  return { success: true, downloadUrl: uploaded.webUrl, invoiceId };
}

export async function deleteVendorOutgoingInvoice(invoiceId: string): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.string().uuid().safeParse(invoiceId);

  if (!parsed.success) {
    return { error: "Invalid invoice" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("expense_vendor_invoices")
    .select("id, invoice_number, trade_id, pdf_onedrive_url, trade:trades(trade_id)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  if (invoice.pdf_onedrive_url) {
    const { data: document, error: documentError } = await supabase
      .from("trade_documents")
      .select("id, onedrive_file_id")
      .eq("onedrive_url", invoice.pdf_onedrive_url)
      .maybeSingle();

    if (documentError) {
      return { error: documentError.message };
    }

    if (document?.onedrive_file_id) {
      await deleteFromOneDrive(document.onedrive_file_id);
    }

    if (document?.id) {
      const { error: deleteDocumentError } = await supabase.from("trade_documents").delete().eq("id", document.id);

      if (deleteDocumentError) {
        return { error: deleteDocumentError.message };
      }
    }
  }

  const { error } = await supabase.from("expense_vendor_invoices").delete().eq("id", invoiceId);

  if (error) {
    if (error.code === "23503") {
      return { error: "This vendor invoice is linked to another record and cannot be deleted yet." };
    }

    return { error: error.message };
  }

  const trade = Array.isArray(invoice.trade) ? invoice.trade[0] : invoice.trade;

  if (invoice.trade_id) {
    await notifyParticipants(
      invoice.trade_id,
      trade?.trade_id ?? "trade",
      access.user.id,
      access.user.name,
      `Vendor invoice ${invoice.invoice_number ?? invoice.id} was deleted.`
    );
    revalidatePath(`/trades/${invoice.trade_id}`);
  }

  return { success: true };
}
