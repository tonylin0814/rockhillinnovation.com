"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager as requireManagerRole } from "@/lib/auth";
import { getNextTradeDocumentVersion } from "@/lib/document-version";
import { notifyParticipants } from "@/lib/notifications";
import { deleteFromOneDrive, uploadToOneDrive } from "@/lib/onedrive";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildSupplierInvoiceOutgoingHtml, type SupplierBanking } from "@/lib/templates/supplier-invoice-outgoing";

export type ActionResult = { success?: true; error?: string; invoiceId?: string; downloadUrl?: string };

type InvoiceKind = "deposit" | "final" | "commercial";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const invoiceSchema = z.object({
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  invoice_number: z.string().trim().min(1, "Invoice number is required"),
  notes: z.string().trim().nullable(),
});

const editableSupplierInvoiceLineSchema = z.object({
  description_chinese: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
    .nullable(),
  description_english: z.string().trim().min(1, "Line description is required"),
  payment_category: z.enum(["outsourced", "produced", "misc_expense"]).default("produced"),
  product_id: z.string().uuid().nullable(),
  quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
  sort_order: z.coerce.number().int().min(0).default(0),
  source_quote_line_id: z.string().uuid().nullable(),
  unit_price_rmb: z.coerce.number().min(0, "Unit price cannot be negative"),
});

const supplierExtraLineSchema = z.object({
  description_chinese: z.string().nullable().default(null),
  description_english: z.string().nullable().default(null),
  amount_rmb: z.coerce
    .number()
    .refine((value) => value !== 0, { message: "Amount cannot be zero" }),
});

const matchSchema = z.object({
  supplier_invoice_ref: z.string().trim().min(1, "Invoice reference is required").max(100),
  supplier_stated_amount_rmb: z.coerce
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than zero"),
});

async function requireManager() {
  const access = await requireManagerRole();

  if ("error" in access) {
    return { error: access.error };
  }

  return access;
}

function parseEditableSupplierInvoiceLines(formData: FormData) {
  const raw = formData.get("supplier_invoice_lines_json");

  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const result = z
      .array(editableSupplierInvoiceLineSchema)
      .min(1, "At least one supplier invoice line is required")
      .safeParse(parsed);

    if (!result.success) {
      return { error: result.error.issues[0]?.message ?? "Invalid supplier invoice lines" };
    }

    return { lines: result.data };
  } catch {
    return { error: "Supplier invoice lines must be valid JSON" };
  }
}

function parseSupplierExtraLines(formData: FormData): Array<{
  description_chinese: string | null;
  description_english: string | null;
  amount_rmb: number;
}> {
  const raw = formData.get("extra_lines_json");

  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  try {
    const result = z.array(supplierExtraLineSchema).safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export async function generateSupplierInvoiceOutgoing(
  tradeId: string,
  formData: FormData,
  invoiceType: InvoiceKind
): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({ invoice: invoiceSchema, tradeId: z.string().uuid() })
    .safeParse({
      invoice: {
        invoice_date: formData.get("invoice_date"),
        invoice_number: formData.get("invoice_number"),
        notes: emptyToNull(formData.get("notes")),
      },
      tradeId,
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }

  const exchangeRateOverride = (() => {
    const raw = formData.get("exchange_rate");
    if (typeof raw !== "string" || !raw.trim()) return null;
    const rate = parseFloat(raw);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  })();
  const supplierExtraLines = parseSupplierExtraLines(formData);

  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id, trade_id, working_exchange_rate")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const { data: session, error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .select("id")
    .eq("trade_id", tradeId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message };
  }

  if (!session) {
    return { error: "No confirmed supplier quote session found. Confirm a quote session first." };
  }

  const { data: rawLines, error: linesError } = await supabase
    .from("supplier_quote_lines")
    .select(
      "id, item_name_chinese, item_name_english, quantity, unit_price_rmb, total_price_rmb, payment_category, sort_order, product:products(id, name_english, name_chinese, product_type, payment_category, supplier_id, supplier:suppliers(id, code, name, name_chinese, address, bank_account_name, bank_account_number, bank_name, bank_address, bank_cnaps_no, bank_swift_code, bank_currency, bank_institution_no, bank_transit_no, bank_tel, banking_instructions))"
    )
    .eq("session_id", session.id)
    .order("sort_order", { ascending: true });

  if (linesError) {
    return { error: linesError.message };
  }

  if (!rawLines?.length) {
    return { error: "No quote lines found in the confirmed session." };
  }

  const specificType = invoiceType === "final" ? "final" : "deposit";
  const { data: rateRow } = await supabase
    .from("exchange_rates")
    .select("id, rate_rmb_per_usd")
    .eq("trade_id", tradeId)
    .eq("payment_type", specificType)
    .maybeSingle();

  const { data: fallbackRateRow } = !rateRow
    ? await supabase
        .from("exchange_rates")
        .select("id, rate_rmb_per_usd")
        .eq("trade_id", tradeId)
        .maybeSingle()
    : { data: null };

  const exchangeRateId: string | null = exchangeRateOverride ? null : (rateRow?.id ?? null);
  const exchangeRate: number | null =
    exchangeRateOverride ??
    rateRow?.rate_rmb_per_usd ??
    fallbackRateRow?.rate_rmb_per_usd ??
    trade.working_exchange_rate ??
    null;

  type QuoteLine = (typeof rawLines)[number];
  type PaymentCategory = "outsourced" | "produced" | "misc_expense";
  const nonSetLines = rawLines.filter((line) => {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;
    return product?.product_type !== "set";
  });

  function paymentCategoryForLine(line: QuoteLine): PaymentCategory | null {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;
    return (line.payment_category ?? product?.payment_category ?? null) as PaymentCategory | null;
  }

  function shouldInclude(line: QuoteLine): boolean {
    if (invoiceType === "commercial") {
      return true;
    }

    const category = paymentCategoryForLine(line);
    if (invoiceType === "deposit") {
      return category === "outsourced" || category === "produced";
    }

    return category === "produced" || category === "misc_expense";
  }

  function pctForLine(line: QuoteLine): number {
    if (invoiceType === "commercial") {
      return 1;
    }

    const category = paymentCategoryForLine(line);

    if (category === "outsourced") {
      return 1;
    }

    if (category === "produced") {
      return 0.5;
    }

    return 1;
  }

  const includedLines = nonSetLines.filter(shouldInclude);

  if (!includedLines.length) {
    return { error: `No applicable lines for a ${invoiceType} invoice. Check payment categories on quote lines.` };
  }

  let supplierName: string | null = null;
  let supplierNameChinese: string | null = null;
  let supplierCode: string | null = null;
  let supplierAddress: string | null = null;
  let supplierBanking: SupplierBanking | null = null;

  for (const line of includedLines) {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;
    const supplier = product
      ? Array.isArray(product.supplier)
        ? product.supplier[0]
        : product.supplier
      : null;

    if (supplier?.name) {
      supplierCode = supplier.code ?? null;
      supplierName = supplier.name;
      supplierNameChinese = supplier.name_chinese ?? null;
      supplierAddress = supplier.address ?? null;
      if (supplier.bank_name || supplier.bank_account_number) {
        supplierBanking = {
          accountName: supplier.bank_account_name ?? null,
          accountNumber: supplier.bank_account_number ?? null,
          bankAddress: supplier.bank_address ?? null,
          bankName: supplier.bank_name ?? null,
          bankTel: supplier.bank_tel ?? null,
          bankingInstructions: supplier.banking_instructions ?? null,
          cnapsNo: supplier.bank_cnaps_no ?? null,
          currency: supplier.bank_currency ?? null,
          swiftCode: supplier.bank_swift_code ?? null,
        };
      }
      break;
    }
  }

  const invoiceLines = includedLines.map((line, index) => {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;
    const paymentCategory = invoiceType === "commercial" ? "produced" : paymentCategoryForLine(line);
    const pct = pctForLine(line);
    const quantity = Number(line.quantity);
    const unitPriceFull = Number(line.unit_price_rmb);
    const totalRmb = roundMoney(quantity * unitPriceFull * pct);
    const paymentPct = Math.round(pct * 100);
    const descriptionChinese = line.item_name_chinese ?? product?.name_chinese ?? null;
    const descriptionEnglish = line.item_name_english ?? product?.name_english ?? "Item";

    return {
      dbLine: {
        description_chinese: descriptionChinese ?? null,
        description_english: descriptionEnglish,
        payment_category: (paymentCategory ?? "produced") as PaymentCategory,
        product_id: product?.id ?? null,
        quantity,
        sort_order: Number(line.sort_order ?? index + 1),
        source_quote_line_id: line.id,
        unit_price_rmb: unitPriceFull,
      },
      pdf: {
        descriptionChinese: descriptionChinese ?? null,
        descriptionEnglish,
        paymentCategory: (paymentCategory ?? "produced") as PaymentCategory,
        paymentPct,
        quantity,
        totalRmb,
        unitPriceRmb: unitPriceFull,
      },
    };
  });
  const extraInvoiceLines = supplierExtraLines.map((line, index) => ({
    dbLine: {
      description_chinese: line.description_chinese,
      description_english: line.description_english,
      payment_category: "misc_expense" as PaymentCategory,
      product_id: null,
      quantity: 1,
      sort_order: invoiceLines.length + index + 1,
      source_quote_line_id: null,
      unit_price_rmb: line.amount_rmb,
    },
    pdf: {
      descriptionChinese: line.description_chinese,
      descriptionEnglish: line.description_english,
      paymentCategory: "misc_expense" as PaymentCategory,
      paymentPct: 100,
      quantity: 1,
      totalRmb: line.amount_rmb,
      unitPriceRmb: line.amount_rmb,
    },
  }));
  const allInvoiceLines = [...invoiceLines, ...extraInvoiceLines];

  const baseTotalRmb = roundMoney(allInvoiceLines.reduce((sum, line) => sum + line.pdf.totalRmb, 0));
  const totalRmb = baseTotalRmb;
  const totalUsd = exchangeRate ? roundMoney(totalRmb / exchangeRate) : null;
  const { data: existingInvoice, error: existingInvoiceError } = await supabase
    .from("supplier_invoices_outgoing")
    .select("id")
    .eq("invoice_number", parsed.data.invoice.invoice_number)
    .maybeSingle();

  if (existingInvoiceError) {
    return { error: existingInvoiceError.message };
  }

  if (existingInvoice) {
    return {
      error: `Supplier invoice ${parsed.data.invoice.invoice_number} already exists. Delete the old invoice from the Supplier Invoices list before generating a new one, or use a different invoice number.`,
    };
  }

  const html = buildSupplierInvoiceOutgoingHtml({
    exchangeRate,
    invoiceDate: parsed.data.invoice.invoice_date,
    invoiceNumber: parsed.data.invoice.invoice_number,
    invoiceType,
    lines: allInvoiceLines.map((line) => line.pdf),
    notes: parsed.data.invoice.notes,
    supplierAddress,
    supplierBanking,
    supplierCode,
    supplierName,
    supplierNameChinese,
    totalRmb,
    totalUsd,
  });
  const pdfBuffer = await generatePdf(html);
  const fileName = `${parsed.data.invoice.invoice_number}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "invoice",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode: trade.trade_id,
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("supplier_invoices_outgoing")
    .insert({
      exchange_rate_id: exchangeRateId,
      invoice_date: parsed.data.invoice.invoice_date,
      invoice_number: parsed.data.invoice.invoice_number,
      invoice_type: invoiceType,
      notes: parsed.data.invoice.notes,
      pdf_onedrive_url: uploaded.webUrl,
      status: "draft",
      total_rmb: totalRmb,
      total_usd: totalUsd,
      trade_id: tradeId,
    })
    .select("id")
    .single();

  if (invoiceError) {
    if (invoiceError.code === "23505") {
      return {
        error: `Supplier invoice ${parsed.data.invoice.invoice_number} already exists. Delete the old invoice from the Supplier Invoices list before generating a new one, or use a different invoice number.`,
      };
    }

    return { error: invoiceError.message };
  }

  const { error: linesInsertError } = await supabase.from("supplier_invoice_outgoing_lines").insert(
    allInvoiceLines.map((line) => ({
      description_chinese: line.dbLine.description_chinese,
      description_english: line.dbLine.description_english,
      invoice_id: invoice.id,
      payment_category: line.dbLine.payment_category,
      product_id: line.dbLine.product_id,
      quantity: line.dbLine.quantity,
      sort_order: line.dbLine.sort_order,
      source_quote_line_id: line.dbLine.source_quote_line_id,
      unit_price_rmb: line.dbLine.unit_price_rmb,
    }))
  );

  if (linesInsertError) {
    return { error: linesInsertError.message };
  }

  const nextDocumentVersion = await getNextTradeDocumentVersion({
    category: "invoice",
    supabase,
    tradeId,
  });

  const { error: documentError } = await supabase.from("trade_documents").insert({
    document_category: "invoice",
    document_type: invoiceType,
    file_name: fileName,
    file_size_bytes: pdfBuffer.length,
    notes: parsed.data.invoice.notes,
    onedrive_file_id: uploaded.fileId,
    onedrive_url: uploaded.webUrl,
    related_party: "supplier",
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
    `A supplier ${invoiceType} invoice was generated for trade ${trade.trade_id}.`
  );
  revalidatePath(`/trades/${tradeId}`);
  return { success: true, downloadUrl: uploaded.webUrl, invoiceId: invoice.id };
}

export async function generateSupplierCommercialInvoice(tradeId: string, formData: FormData): Promise<ActionResult> {
  return generateSupplierInvoiceOutgoing(tradeId, formData, "commercial");
}

export async function updateSupplierInvoiceStatus(
  invoiceId: string,
  status: "draft" | "sent" | "paid"
): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      invoiceId: z.string().uuid(),
      status: z.enum(["draft", "sent", "paid"]),
    })
    .safeParse({ invoiceId, status });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error } = await supabase
    .from("supplier_invoices_outgoing")
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

export async function updateSupplierInvoice(invoiceId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      invoiceId: z.string().uuid(),
      invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid invoice date"),
      invoice_number: z.string().trim().min(1, "Invoice number is required"),
      notes: z
        .string()
        .trim()
        .transform((value) => (value.length ? value : null))
        .nullable(),
      status: z.enum(["draft", "sent", "paid"]),
      supplier_invoice_ref: z
        .string()
        .trim()
        .transform((value) => (value.length ? value : null))
        .nullable(),
      supplier_stated_amount_rmb: z.preprocess(
        (value) => (value === "" || value === null ? null : value),
        z.coerce.number().positive("Supplier stated amount must be greater than zero").nullable()
      ),
    })
    .safeParse({
      invoiceId,
      invoice_date: formData.get("invoice_date"),
      invoice_number: formData.get("invoice_number"),
      notes: formData.get("notes"),
      status: formData.get("status"),
      supplier_invoice_ref: formData.get("supplier_invoice_ref"),
      supplier_stated_amount_rmb: formData.get("supplier_stated_amount_rmb"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("supplier_invoices_outgoing")
    .select("id, trade_id, exchange_rate_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  const parsedLines = parseEditableSupplierInvoiceLines(formData);

  if (parsedLines?.error) {
    return { error: parsedLines.error };
  }

  const invoiceLines = parsedLines?.lines ?? null;
  const updatePayload: Record<string, unknown> = {
    invoice_date: parsed.data.invoice_date,
    invoice_number: parsed.data.invoice_number,
    notes: parsed.data.notes,
    status: parsed.data.status,
    supplier_invoice_ref: parsed.data.supplier_invoice_ref,
    supplier_stated_amount_rmb: parsed.data.supplier_stated_amount_rmb,
  };

  if (invoiceLines) {
    const lineTotalRmb = roundMoney(
      invoiceLines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price_rmb), 0)
    );
    const { data: adjustments, error: adjustmentsError } = await supabase
      .from("supplier_invoice_adjustments")
      .select("amount_rmb")
      .eq("invoice_id", invoiceId);

    if (adjustmentsError) {
      return { error: adjustmentsError.message };
    }

    const adjustmentTotalRmb = roundMoney(
      (adjustments ?? []).reduce((sum, adjustment) => sum + Number(adjustment.amount_rmb), 0)
    );
    const totalRmb = roundMoney(lineTotalRmb + adjustmentTotalRmb);
    updatePayload.total_rmb = totalRmb;

    let exchangeRate: number | null = null;

    if (invoice.exchange_rate_id) {
      const { data: rateRow, error: rateError } = await supabase
        .from("exchange_rates")
        .select("rate_rmb_per_usd")
        .eq("id", invoice.exchange_rate_id)
        .maybeSingle();

      if (rateError) {
        return { error: rateError.message };
      }

      exchangeRate = rateRow?.rate_rmb_per_usd ?? null;
    }

    if (!exchangeRate) {
      const { data: trade, error: tradeError } = await supabase
        .from("trades")
        .select("working_exchange_rate")
        .eq("id", invoice.trade_id)
        .maybeSingle();

      if (tradeError) {
        return { error: tradeError.message };
      }

      exchangeRate = trade?.working_exchange_rate ?? null;
    }

    if (exchangeRate) {
      updatePayload.total_usd = roundMoney(totalRmb / exchangeRate);
    }
  }

  const { error } = await supabase
    .from("supplier_invoices_outgoing")
    .update(updatePayload)
    .eq("id", invoiceId);

  if (error) {
    if (error.code === "23505") {
      return { error: `Supplier invoice ${parsed.data.invoice_number} already exists.` };
    }

    return { error: error.message };
  }

  if (invoiceLines) {
    const { error: deleteLinesError } = await supabase
      .from("supplier_invoice_outgoing_lines")
      .delete()
      .eq("invoice_id", invoiceId);

    if (deleteLinesError) {
      return { error: deleteLinesError.message };
    }

    const { error: insertLinesError } = await supabase.from("supplier_invoice_outgoing_lines").insert(
      invoiceLines.map((line) => ({
        description_chinese: line.description_chinese,
        description_english: line.description_english,
        invoice_id: invoiceId,
        payment_category: line.payment_category,
        product_id: line.product_id,
        quantity: line.quantity,
        sort_order: line.sort_order,
        source_quote_line_id: line.source_quote_line_id,
        unit_price_rmb: line.unit_price_rmb,
      }))
    );

    if (insertLinesError) {
      return { error: insertLinesError.message };
    }
  }

  revalidatePath(`/trades/${invoice.trade_id}`);
  return { success: true };
}

export async function deleteSupplierInvoice(invoiceId: string): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.object({ invoiceId: z.string().uuid() }).safeParse({ invoiceId });

  if (!parsed.success) {
    return { error: "Invalid invoice" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("supplier_invoices_outgoing")
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

  const { error: linesError } = await supabase.from("supplier_invoice_outgoing_lines").delete().eq("invoice_id", invoiceId);

  if (linesError) {
    return { error: linesError.message };
  }

  const { error: adjustmentsError } = await supabase.from("supplier_invoice_adjustments").delete().eq("invoice_id", invoiceId);

  if (adjustmentsError) {
    return { error: adjustmentsError.message };
  }

  const { error: deleteError } = await supabase.from("supplier_invoices_outgoing").delete().eq("id", invoiceId);

  if (deleteError) {
    if (deleteError.code === "23503") {
      return { error: "This supplier invoice is linked to another record and cannot be deleted yet." };
    }

    return { error: deleteError.message };
  }

  const trade = Array.isArray(invoice.trade) ? invoice.trade[0] : invoice.trade;

  await notifyParticipants(
    invoice.trade_id,
    trade?.trade_id ?? "trade",
    access.user.id,
    access.user.name,
    `Supplier invoice ${invoice.invoice_number} was deleted.`
  );

  revalidatePath(`/trades/${invoice.trade_id}`);
  return { success: true };
}

export async function matchSupplierInvoice(invoiceId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const invoiceIdParsed = z.string().uuid().safeParse(invoiceId);

  if (!invoiceIdParsed.success) {
    return { error: "Invalid invoice ID" };
  }

  const parsed = matchSchema.safeParse({
    supplier_invoice_ref: formData.get("supplier_invoice_ref"),
    supplier_stated_amount_rmb: formData.get("supplier_stated_amount_rmb"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: fetchError } = await supabase
    .from("supplier_invoices_outgoing")
    .select("id, trade_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  const { error } = await supabase
    .from("supplier_invoices_outgoing")
    .update({
      supplier_invoice_ref: parsed.data.supplier_invoice_ref,
      supplier_stated_amount_rmb: parsed.data.supplier_stated_amount_rmb,
    })
    .eq("id", invoiceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/trades/${invoice.trade_id}`);
  return { success: true };
}
