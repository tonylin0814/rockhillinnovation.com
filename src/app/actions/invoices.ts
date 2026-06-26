"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { getNextTradeDocumentVersion } from "@/lib/document-version";
import { notifyParticipants } from "@/lib/notifications";
import { deleteFromOneDrive, uploadToOneDrive } from "@/lib/onedrive";
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

type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>;

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

type InvoiceSourceData = {
  bankingAccount: any;
  client: {
    address: string | null;
    currency: string | null;
    deposit_pct: number | null;
    id: string;
    name: string;
    shipping_address: string | null;
  };
  companySettings: any;
  invoiceLines: Array<{
    components: { code: string | null; name: string; quantityPerSet: number }[];
    dbQuantity: number;
    description: string;
    itemCode: string | null;
    quantity: number;
    sortOrder: number;
    total: number;
    unitPrice: number;
  }>;
  subtotal: number;
  trade: {
    id: string;
    trade_id: string;
  };
};

const invoiceStatusSchema = z.enum(["draft", "sent", "paid"]);
const editableInvoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Line description is required"),
  quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
  sort_order: z.coerce.number().int().min(0).default(0),
  unit_price_usd: z.coerce.number().min(0, "Unit price cannot be negative"),
});

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

function parseEditableInvoiceLines(formData: FormData) {
  const raw = formData.get("invoice_lines_json");

  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const result = z.array(editableInvoiceLineSchema).min(1, "At least one invoice line is required").safeParse(parsed);

    if (!result.success) {
      return { error: result.error.issues[0]?.message ?? "Invalid invoice lines" };
    }

    return { lines: result.data };
  } catch {
    return { error: "Invoice lines must be valid JSON" };
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

function getBaseCode(code: string | null): string | null {
  if (!code) return null;
  return code.replace(/-\d+$/, "");
}

async function ensureInvoiceNumberAvailable(
  supabase: ServerSupabaseClient,
  invoiceNumber: string,
  excludeInvoiceId?: string
) {
  let query = supabase.from("client_invoices").select("id").eq("invoice_number", invoiceNumber);

  if (excludeInvoiceId) {
    query = query.neq("id", excludeInvoiceId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (data) {
    return {
      error: `Invoice ${invoiceNumber} already exists. Use the existing invoice in the Invoices list, or delete it before regenerating.`,
    };
  }

  return { success: true as const };
}

async function getInvoiceSourceData(
  supabase: ServerSupabaseClient,
  tradeId: string
): Promise<InvoiceSourceData | { error: string }> {
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select(
      `id, trade_id,
       client:clients(id, name, address, currency, shipping_address, deposit_pct)`
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
            .reduce<{ code: string | null; name: string; quantityPerSet: number }[]>((acc, comp) => {
              const base = getBaseCode(comp.code);
              if (acc.some((existing) => getBaseCode(existing.code) === base)) return acc;
              return [...acc, { ...comp, code: base }];
            }, [])
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

  return {
    bankingAccount: Array.isArray(bankingAccounts) ? (bankingAccounts[0] ?? null) : (bankingAccounts ?? null),
    client,
    companySettings: companySettings ?? null,
    invoiceLines,
    subtotal: roundMoney(invoiceLines.reduce((sum, line) => sum + line.total, 0)),
    trade,
  };
}

export async function generateCommercialInvoice(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error ?? "Unauthorized" };
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
            .reduce<{ code: string | null; name: string; quantityPerSet: number }[]>((acc, comp) => {
              const base = getBaseCode(comp.code);
              if (acc.some((existing) => getBaseCode(existing.code) === base)) return acc;
              return [...acc, { ...comp, code: base }];
            }, [])
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

  const nextDocumentVersion = await getNextTradeDocumentVersion({
    category: "invoice",
    supabase,
    tradeId,
  });

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
    `A commercial invoice was generated for trade ${trade.trade_id}.`
  );
  revalidatePath(`/trades/${tradeId}`);
  return { success: true, downloadUrl: uploaded.webUrl, invoiceId: invoice.id };
}

export const generateProForma = (tradeId: string, formData: FormData) =>
  generateCommercialInvoice(tradeId, formData);

export async function generateDepositInvoice(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const invoiceNumber = emptyToNull(formData.get("invoice_number"));
  const invoiceDate = emptyToNull(formData.get("invoice_date"));
  const notes = emptyToNull(formData.get("notes"));

  if (!invoiceNumber) {
    return { error: "Invoice number is required" };
  }

  if (!invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
    return { error: "Invoice date is required" };
  }

  const supabase = createServerSupabaseClient();
  const available = await ensureInvoiceNumberAvailable(supabase, invoiceNumber);

  if ("error" in available) {
    return available;
  }

  const source = await getInvoiceSourceData(supabase, tradeId);

  if ("error" in source) {
    return { error: source.error };
  }

  const depositPct = Math.min(100, Math.max(0, Number(source.client.deposit_pct) || 50));
  const totalUsd = roundMoney((source.subtotal * depositPct) / 100);
  const logoBase64 = loadLogoBase64();

  const html = buildProFormaHtml({
    adjustmentLines: [],
    bankingAccount: source.bankingAccount,
    billToAddress: source.client.address ?? null,
    billToName: source.client.name,
    companyInfo: source.companySettings,
    currency: source.client.currency ?? "USD",
    depositPct,
    invoiceDate: normalizeDate(invoiceDate),
    invoiceNumber,
    invoiceType: "deposit",
    lines: source.invoiceLines,
    logoBase64,
    notes,
    paymentTerms: null,
    shipToAddress: source.client.shipping_address ?? null,
    shipToName: source.client.name,
    subtotal: source.subtotal,
    total: totalUsd,
  });

  const pdfBuffer = await generatePdf(html);
  const fileName = `${invoiceNumber}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "invoice",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode: source.trade.trade_id,
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoices")
    .insert({
      adjustment_lines: [],
      deposit_pct: depositPct,
      display_label: null,
      due_date: null,
      invoice_date: invoiceDate,
      invoice_number: invoiceNumber,
      invoice_type: "deposit",
      notes,
      payment_terms: null,
      pdf_onedrive_url: uploaded.webUrl,
      status: "draft",
      subtotal_usd: source.subtotal,
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
    source.invoiceLines.map((line) => ({
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

  const nextDocumentVersion = await getNextTradeDocumentVersion({
    category: "invoice",
    supabase,
    tradeId,
  });

  const { error: documentError } = await supabase.from("trade_documents").insert({
    document_category: "invoice",
    document_type: "deposit",
    file_name: fileName,
    file_size_bytes: pdfBuffer.length,
    notes,
    onedrive_file_id: uploaded.fileId,
    onedrive_url: uploaded.webUrl,
    related_party: "client",
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
    source.trade.trade_id,
    access.user.id,
    access.user.name,
    `A deposit invoice was generated for trade ${source.trade.trade_id}.`
  );
  revalidatePath(`/trades/${tradeId}`);
  return { success: true, downloadUrl: uploaded.webUrl, invoiceId: invoice.id };
}

const finalInvoiceSchema = z.object({
  display_label: z.string().trim().min(1, "Display label is required"),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid invoice date"),
  invoice_number: z.string().trim().min(1, "Invoice number is required"),
  notes: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
    .nullable(),
});

export async function getTradeRemainingBalance(
  tradeId: string
): Promise<{ depositsPaid: number; remaining: number; subtotal: number } | { error: string }> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error ?? "Unauthorized" };
  }

  const supabase = createServerSupabaseClient();
  const source = await getInvoiceSourceData(supabase, tradeId);

  if ("error" in source) {
    return source;
  }

  const { data: priorDeposits, error: depositError } = await supabase
    .from("client_invoices")
    .select("total_usd")
    .eq("trade_id", tradeId)
    .eq("invoice_type", "deposit");

  if (depositError) {
    return { error: depositError.message };
  }

  const depositsPaid = roundMoney((priorDeposits ?? []).reduce((sum, invoice) => sum + Number(invoice.total_usd), 0));

  return {
    depositsPaid,
    remaining: roundMoney(source.subtotal - depositsPaid),
    subtotal: source.subtotal,
  };
}

export async function generateFinalInvoice(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = finalInvoiceSchema.safeParse({
    display_label: formData.get("display_label"),
    invoice_date: formData.get("invoice_date"),
    invoice_number: formData.get("invoice_number"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }

  const supabase = createServerSupabaseClient();
  const available = await ensureInvoiceNumberAvailable(supabase, parsed.data.invoice_number);

  if ("error" in available) {
    return available;
  }

  const source = await getInvoiceSourceData(supabase, tradeId);

  if ("error" in source) {
    return source;
  }

  const balance = await getTradeRemainingBalance(tradeId);

  if ("error" in balance) {
    return balance;
  }

  const adjustmentLines = parseAdjustmentLines(formData);
  const adjustmentsTotal = adjustmentLines.reduce((sum, adjustment) => sum + adjustment.amount_usd, 0);
  const totalUsd = roundMoney(balance.remaining + adjustmentsTotal);
  const logoBase64 = loadLogoBase64();

  const html = buildProFormaHtml({
    adjustmentLines,
    balanceLine: {
      amountUsd: balance.remaining,
      label: "Order Balance Due",
    },
    bankingAccount: source.bankingAccount,
    billToAddress: source.client.address ?? null,
    billToName: source.client.name,
    companyInfo: source.companySettings,
    currency: source.client.currency ?? "USD",
    depositPct: 0,
    invoiceDate: normalizeDate(parsed.data.invoice_date),
    invoiceNumber: parsed.data.invoice_number,
    invoiceType: "final",
    lines: [],
    logoBase64,
    notes: parsed.data.notes,
    paymentTerms: null,
    shipToAddress: source.client.shipping_address ?? null,
    shipToName: source.client.name,
    subtotal: balance.remaining,
    total: totalUsd,
  });

  const pdfBuffer = await generatePdf(html);
  const fileName = `${parsed.data.invoice_number}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "invoice",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode: source.trade.trade_id,
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoices")
    .insert({
      adjustment_lines: adjustmentLines,
      deposit_pct: 0,
      display_label: parsed.data.display_label,
      due_date: null,
      invoice_date: parsed.data.invoice_date,
      invoice_number: parsed.data.invoice_number,
      invoice_type: "final",
      notes: parsed.data.notes,
      payment_terms: null,
      pdf_onedrive_url: uploaded.webUrl,
      status: "draft",
      subtotal_usd: balance.remaining,
      total_usd: totalUsd,
      trade_id: tradeId,
    })
    .select("id")
    .single();

  if (invoiceError) {
    if (invoiceError.code === "23505") {
      return {
        error: `Invoice ${parsed.data.invoice_number} already exists. Use the existing invoice in the Invoices list, or delete it before regenerating.`,
      };
    }

    return { error: invoiceError.message };
  }

  const { error: linesError } = await supabase.from("client_invoice_lines").insert({
    description: "Order Balance Due",
    invoice_id: invoice.id,
    quantity: 1,
    sort_order: 0,
    unit_price_usd: balance.remaining,
  });

  if (linesError) {
    return { error: linesError.message };
  }

  const nextDocumentVersion = await getNextTradeDocumentVersion({
    category: "invoice",
    supabase,
    tradeId,
  });

  const { error: documentError } = await supabase.from("trade_documents").insert({
    document_category: "invoice",
    document_type: "final",
    file_name: fileName,
    file_size_bytes: pdfBuffer.length,
    notes: parsed.data.notes,
    onedrive_file_id: uploaded.fileId,
    onedrive_url: uploaded.webUrl,
    related_party: "client",
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
    source.trade.trade_id,
    access.user.id,
    access.user.name,
    `${parsed.data.display_label} was generated for trade ${source.trade.trade_id}.`
  );
  revalidatePath(`/trades/${tradeId}`);
  return { success: true, downloadUrl: uploaded.webUrl, invoiceId: invoice.id };
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
    .object({ invoiceId: z.string().uuid(), status: invoiceStatusSchema })
    .safeParse({ invoiceId, status });

  if (!parsed.success) {
    return { error: "Invalid invoice status" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoices")
    .select("id, trade_id, adjustment_lines")
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

export async function updateClientInvoice(invoiceId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireInvoiceManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      invoiceId: z.string().uuid(),
      invoice_number: z.string().trim().min(1, "Invoice number is required"),
      invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid invoice date"),
      due_date: z
        .string()
        .trim()
        .transform((value) => (value.length ? value : null))
        .nullable(),
      deposit_pct: z.coerce.number().min(0).max(100),
      payment_terms: z
        .string()
        .trim()
        .transform((value) => (value.length ? value : null))
        .nullable(),
      notes: z
        .string()
        .trim()
        .transform((value) => (value.length ? value : null))
        .nullable(),
      status: invoiceStatusSchema,
    })
    .safeParse({
      invoiceId,
      invoice_number: formData.get("invoice_number"),
      invoice_date: formData.get("invoice_date"),
      due_date: formData.get("due_date"),
      deposit_pct: formData.get("deposit_pct"),
      payment_terms: formData.get("payment_terms"),
      notes: formData.get("notes"),
      status: formData.get("status"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoices")
    .select("id, trade_id, adjustment_lines")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  const available = await ensureInvoiceNumberAvailable(supabase, parsed.data.invoice_number, invoiceId);

  if ("error" in available) {
    return available;
  }

  const parsedLines = parseEditableInvoiceLines(formData);

  if (parsedLines?.error) {
    return { error: parsedLines.error };
  }

  const invoiceLines = parsedLines?.lines ?? null;
  const subtotalUsd = invoiceLines
    ? roundMoney(invoiceLines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price_usd), 0))
    : null;
  const adjustmentLines = Array.isArray(invoice.adjustment_lines)
    ? (invoice.adjustment_lines as InvoiceAdjustmentLine[])
    : [];
  const adjustmentsTotal = adjustmentLines.reduce((sum, adjustment) => sum + Number(adjustment.amount_usd), 0);

  const updatePayload: Record<string, unknown> = {
    deposit_pct: parsed.data.deposit_pct,
    due_date: parsed.data.due_date,
    invoice_date: parsed.data.invoice_date,
    invoice_number: parsed.data.invoice_number,
    notes: parsed.data.notes,
    payment_terms: parsed.data.payment_terms,
    status: parsed.data.status,
  };

  if (subtotalUsd !== null) {
    updatePayload.subtotal_usd = subtotalUsd;
    updatePayload.total_usd = roundMoney(subtotalUsd + adjustmentsTotal);
  }

  const { error } = await supabase
    .from("client_invoices")
    .update(updatePayload)
    .eq("id", invoiceId);

  if (error) {
    if (error.code === "23505") {
      return { error: `Invoice ${parsed.data.invoice_number} already exists.` };
    }

    return { error: error.message };
  }

  if (invoiceLines) {
    const { error: deleteLinesError } = await supabase.from("client_invoice_lines").delete().eq("invoice_id", invoiceId);

    if (deleteLinesError) {
      return { error: deleteLinesError.message };
    }

    const { error: insertLinesError } = await supabase.from("client_invoice_lines").insert(
      invoiceLines.map((line) => ({
        description: line.description,
        invoice_id: invoiceId,
        quantity: line.quantity,
        sort_order: line.sort_order,
        unit_price_usd: line.unit_price_usd,
      }))
    );

    if (insertLinesError) {
      return { error: insertLinesError.message };
    }
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
