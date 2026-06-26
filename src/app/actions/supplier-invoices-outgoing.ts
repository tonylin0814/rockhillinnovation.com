"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager as requireManagerRole } from "@/lib/auth";
import { getNextTradeDocumentVersion } from "@/lib/document-version";
import { notifyParticipants } from "@/lib/notifications";
import { uploadToOneDrive } from "@/lib/onedrive";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildSupplierInvoiceOutgoingHtml, type SupplierBanking } from "@/lib/templates/supplier-invoice-outgoing";

export type ActionResult = { success?: true; error?: string; invoiceId?: string; downloadUrl?: string };

type InvoiceKind = "deposit" | "final";
type SupplierInvoiceAdjustmentInput = {
  amount_rmb: number;
  description: string;
};

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

const adjustmentSchema = z.object({
  amount_rmb: z.coerce.number().positive("Adjustment amount must be greater than zero"),
  description: z.string().trim().min(1, "Adjustment description is required"),
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

function parseAdjustments(formData: FormData, invoiceType: InvoiceKind) {
  if (invoiceType !== "final") {
    return { adjustments: [] as SupplierInvoiceAdjustmentInput[] };
  }

  const raw = emptyToNull(formData.get("adjustments_json"));

  if (!raw) {
    return { adjustments: [] as SupplierInvoiceAdjustmentInput[] };
  }

  try {
    const parsedJson = JSON.parse(raw);
    const parsed = z.array(adjustmentSchema).safeParse(parsedJson);

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid adjustment lines" };
    }

    return {
      adjustments: parsed.data.map((adjustment) => ({
        amount_rmb: roundMoney(adjustment.amount_rmb),
        description: adjustment.description,
      })),
    };
  } catch {
    return { error: "Invalid adjustment lines" };
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

  const parsedAdjustments = parseAdjustments(formData, invoiceType);

  if ("error" in parsedAdjustments) {
    return { error: parsedAdjustments.error };
  }

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
      "id, item_name_chinese, item_name_english, quantity, unit_price_rmb, total_price_rmb, payment_category, sort_order, product:products(id, name_english, name_chinese, product_type, payment_category, supplier_id, supplier:suppliers(id, name, address, bank_account_name, bank_account_number, bank_name, bank_address, bank_cnaps_no, bank_swift_code, bank_currency, bank_institution_no, bank_transit_no, bank_tel, banking_instructions))"
    )
    .eq("session_id", session.id)
    .order("sort_order", { ascending: true });

  if (linesError) {
    return { error: linesError.message };
  }

  if (!rawLines?.length) {
    return { error: "No quote lines found in the confirmed session." };
  }

  const { data: rateRow } = await supabase
    .from("exchange_rates")
    .select("id, rate_rmb_per_usd")
    .eq("trade_id", tradeId)
    .eq("payment_type", invoiceType)
    .maybeSingle();

  const exchangeRateId: string | null = rateRow?.id ?? null;
  const exchangeRate: number | null = rateRow?.rate_rmb_per_usd ?? trade.working_exchange_rate ?? null;

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
    const category = paymentCategoryForLine(line);
    if (invoiceType === "deposit") {
      return category === "outsourced" || category === "produced";
    }

    return category === "produced" || category === "misc_expense";
  }

  function pctForLine(line: QuoteLine): number {
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
  const consolidatedLines = Object.values(
    includedLines.reduce<Record<string, QuoteLine>>((acc, line) => {
      const product = Array.isArray(line.product) ? line.product[0] : line.product;
      const key = product?.id ?? line.item_name_english ?? line.id;

      if (acc[key]) {
        const nextQuantity = Number(acc[key].quantity) + Number(line.quantity);
        const nextTotal = Number(acc[key].total_price_rmb) + Number(line.total_price_rmb);

        acc[key] = {
          ...acc[key],
          quantity: nextQuantity,
          total_price_rmb: nextTotal,
          unit_price_rmb: nextQuantity > 0 ? nextTotal / nextQuantity : acc[key].unit_price_rmb,
        };
      } else {
        acc[key] = { ...line };
      }

      return acc;
    }, {})
  );

  if (!consolidatedLines.length) {
    return { error: `No applicable lines for a ${invoiceType} invoice. Check payment categories on quote lines.` };
  }

  let supplierName: string | null = null;
  let supplierAddress: string | null = null;
  let supplierBanking: SupplierBanking | null = null;

  for (const line of consolidatedLines) {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;
    const supplier = product
      ? Array.isArray(product.supplier)
        ? product.supplier[0]
        : product.supplier
      : null;

    if (supplier?.name) {
      supplierName = supplier.name;
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

  const invoiceLines = consolidatedLines.map((line, index) => {
    const product = Array.isArray(line.product) ? line.product[0] : line.product;
    const paymentCategory = paymentCategoryForLine(line);
    const pct = pctForLine(line);
    const quantity = Number(line.quantity);
    const unitPriceFull = Number(line.unit_price_rmb);
    const unitPriceInvoice = roundMoney(unitPriceFull * pct);
    const totalRmb = roundMoney(quantity * unitPriceInvoice);
    const paymentPct = Math.round(pct * 100);
    const descriptionChinese = line.item_name_chinese ?? product?.name_chinese ?? null;
    const descriptionEnglish = line.item_name_english ?? product?.name_english ?? "Item";

    return {
      dbLine: {
        description_chinese: descriptionChinese ?? null,
        description_english: descriptionEnglish,
        payment_category: paymentCategory as PaymentCategory,
        product_id: product?.id ?? null,
        quantity,
        sort_order: Number(line.sort_order ?? index + 1),
        source_quote_line_id: line.id,
        unit_price_rmb: unitPriceInvoice,
      },
      pdf: {
        descriptionChinese: descriptionChinese ?? null,
        descriptionEnglish,
        paymentCategory: paymentCategory as PaymentCategory,
        paymentPct,
        quantity,
        totalRmb,
        unitPriceRmb: unitPriceInvoice,
      },
    };
  });

  const adjustmentLines = parsedAdjustments.adjustments.map((adjustment, index) => ({
    dbLine: {
      amount_rmb: adjustment.amount_rmb,
      description: adjustment.description,
    },
    pdf: {
      descriptionChinese: null,
      descriptionEnglish: adjustment.description,
      paymentCategory: "adjustment" as const,
      paymentPct: 100,
      quantity: 1,
      totalRmb: adjustment.amount_rmb,
      unitPriceRmb: adjustment.amount_rmb,
    },
    sortOrder: invoiceLines.length + index + 1,
  }));
  const baseTotalRmb = roundMoney(invoiceLines.reduce((sum, line) => sum + line.pdf.totalRmb, 0));
  const adjustmentTotalRmb = roundMoney(adjustmentLines.reduce((sum, line) => sum + line.pdf.totalRmb, 0));
  const totalRmb = roundMoney(baseTotalRmb + adjustmentTotalRmb);
  const totalUsd = exchangeRate ? roundMoney(totalRmb / exchangeRate) : null;
  const html = buildSupplierInvoiceOutgoingHtml({
    exchangeRate,
    invoiceDate: parsed.data.invoice.invoice_date,
    invoiceNumber: parsed.data.invoice.invoice_number,
    invoiceType,
    lines: [...invoiceLines.map((line) => line.pdf), ...adjustmentLines.map((line) => line.pdf)],
    notes: parsed.data.invoice.notes,
    supplierAddress,
    supplierBanking,
    supplierName,
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
    return { error: invoiceError.message };
  }

  const { error: linesInsertError } = await supabase.from("supplier_invoice_outgoing_lines").insert(
    invoiceLines.map((line) => ({
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

  if (adjustmentLines.length) {
    const { error: adjustmentError } = await supabase.from("supplier_invoice_adjustments").insert(
      adjustmentLines.map((line) => ({
        amount_rmb: line.dbLine.amount_rmb,
        description: line.dbLine.description,
        invoice_id: invoice.id,
        notes: null,
      }))
    );

    if (adjustmentError) {
      return { error: adjustmentError.message };
    }
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
    .select("id, invoice_number, trade_id, trade:trades(trade_id)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
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
