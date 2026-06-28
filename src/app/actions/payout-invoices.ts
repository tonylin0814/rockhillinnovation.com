"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { deleteFromOneDrive, uploadToOneDrive } from "@/lib/onedrive";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { buildVendorOutgoingInvoiceHtml } from "@/lib/templates/vendor-invoices/dispatcher";

export type ActionResult = { success?: true; error?: string };

const lineSchema = z.object({
  amount_usd: z.coerce.number(),
  description: z.string().trim().min(1, "Description is required"),
});

async function requireAdminOrController() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  if (user.role !== "admin" && user.role !== "controller") {
    return { error: "Admins and controllers only" };
  }
  return { user };
}

function buildCompanyAddress(company: {
  address_line1?: string | null;
  address_line2?: string | null;
  city_state?: string | null;
  country?: string | null;
} | null) {
  return [company?.address_line1, company?.address_line2, company?.city_state, company?.country]
    .filter(Boolean)
    .join("\n");
}

function safeFileName(value: string) {
  return value.replace(/[^\w\-.]/g, "-");
}

function looksLikeBankingNotes(value: string | null | undefined) {
  if (!value) return false;
  return /\b(account|bank|swift|bic|aba|routing|transit|institution|wire|branch)\b/i.test(value);
}

function vendorBankingFromRecord(vendor: {
  bank_aba_routing?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_address?: string | null;
  bank_currency?: string | null;
  bank_institution_no?: string | null;
  bank_name?: string | null;
  bank_swift_code?: string | null;
  bank_tel?: string | null;
  bank_transit_no?: string | null;
  banking_instructions?: string | null;
  notes?: string | null;
}) {
  const hasStructuredBanking =
    vendor.bank_aba_routing ||
    vendor.bank_account_name ||
    vendor.bank_account_number ||
    vendor.bank_address ||
    vendor.bank_currency ||
    vendor.bank_institution_no ||
    vendor.bank_name ||
    vendor.bank_swift_code ||
    vendor.bank_tel ||
    vendor.bank_transit_no ||
    vendor.banking_instructions;

  return {
    abaRouting: vendor.bank_aba_routing ?? null,
    accountName: vendor.bank_account_name ?? null,
    accountNumber: vendor.bank_account_number ?? null,
    bankAddress: vendor.bank_address ?? null,
    bankName: vendor.bank_name ?? null,
    bankTel: vendor.bank_tel ?? null,
    bankingInstructions:
      vendor.banking_instructions ?? (!hasStructuredBanking && looksLikeBankingNotes(vendor.notes) ? vendor.notes ?? null : null),
    currency: vendor.bank_currency ?? null,
    institutionNo: vendor.bank_institution_no ?? null,
    swiftCode: vendor.bank_swift_code ?? null,
    transitNo: vendor.bank_transit_no ?? null,
  };
}

function parseLines(formData: FormData) {
  const raw = formData.get("lines");
  if (typeof raw !== "string") {
    throw new Error("Invoice lines are required");
  }

  const parsed = JSON.parse(raw);
  return z.array(lineSchema).min(1, "Add at least one invoice line").parse(parsed);
}

export async function generatePayoutInvoice(
  tradeId: string,
  tradeShareholderId: string,
  formData: FormData
): Promise<ActionResult & { invoiceUrl?: string }> {
  const access = await requireAdminOrController();
  if ("error" in access) return { error: access.error };

  let lines: z.infer<typeof lineSchema>[];

  try {
    lines = parseLines(formData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Invalid invoice lines" };
    }
    return { error: "Invoice lines must be valid JSON" };
  }

  const parsed = z
    .object({
      invoiceDate: z.string().trim().min(1, "Invoice date is required"),
      invoiceNumber: z.string().trim().min(1, "Invoice number is required"),
      notes: z.string().trim().optional(),
      tradeId: z.string().uuid(),
      tradeShareholderId: z.string().uuid(),
    })
    .safeParse({
      invoiceDate: formData.get("invoice_date"),
      invoiceNumber: formData.get("invoice_number"),
      notes: formData.get("notes"),
      tradeId,
      tradeShareholderId,
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payout invoice request" };
  }

  const supabase = createServerSupabaseAdmin();
  const [{ data: trade, error: tradeError }, { data: companySettings }] = await Promise.all([
    supabase
      .from("trades")
      .select(
        `id,
        trade_id,
        book:shareholder_book(
          net_profit_usd,
          lines:shareholder_book_lines(
            id,
            trade_shareholder_id,
            person_name,
            split_pct,
            net_share_usd
          )
        ),
        shareholders:trade_shareholders(
          id,
          person_name,
          split_pct,
          user_id,
          expense_vendor_id,
          expense_vendor:expense_vendors(
            id,
            code,
            name,
            address
          )
        )`
      )
      .eq("id", parsed.data.tradeId)
      .maybeSingle(),
    supabase
      .from("company_settings")
      .select("company_name_full, company_name, address_line1, address_line2, city_state, country")
      .limit(1)
      .maybeSingle(),
  ]);

  if (tradeError || !trade) {
    return { error: tradeError?.message ?? "Trade not found" };
  }

  const shareholders = Array.isArray(trade.shareholders) ? trade.shareholders : [trade.shareholders];
  const shareholder = shareholders.find((item) => item?.id === parsed.data.tradeShareholderId);

  if (!shareholder) {
    return { error: "Shareholder not found" };
  }

  const nestedVendor = Array.isArray(shareholder.expense_vendor)
    ? shareholder.expense_vendor[0]
    : shareholder.expense_vendor;

  const vendorId = shareholder.expense_vendor_id ?? nestedVendor?.id;

  if (!vendorId) {
    return { error: "This shareholder does not have an invoice vendor selected." };
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("expense_vendors")
    .select(
      `id,
       code,
       name,
       address,
       notes,
       bank_account_name,
       bank_account_number,
       bank_name,
       bank_address,
       bank_swift_code,
       bank_aba_routing,
       bank_institution_no,
       bank_transit_no,
       bank_tel,
       bank_currency,
       banking_instructions`
    )
    .eq("id", vendorId)
    .maybeSingle();

  if (vendorError) {
    return { error: vendorError.message };
  }

  if (!vendor) {
    return { error: "This shareholder does not have an invoice vendor selected." };
  }

  if (!["LM", "SGRACO"].includes(String(vendor.code).toUpperCase())) {
    return { error: `No payout template is registered for vendor code ${vendor.code}.` };
  }

  const bookArr = Array.isArray(trade.book) ? trade.book : [trade.book];
  const book = bookArr[0] ?? null;
  const netProfitUsd = Number(book?.net_profit_usd ?? 0);
  const bookLines = book?.lines ? (Array.isArray(book.lines) ? book.lines : [book.lines]) : [];
  const bookLine = bookLines.find((line) => line?.trade_shareholder_id === parsed.data.tradeShareholderId);
  const fallbackDividend = (netProfitUsd * Number(shareholder.split_pct ?? 0)) / 100;
  const dividendUsd = Math.round(Number(bookLine?.net_share_usd ?? fallbackDividend) * 100) / 100;
  const totalUsd = Math.round(lines.reduce((sum, line) => sum + Number(line.amount_usd), 0) * 100) / 100;
  const billToName =
    companySettings?.company_name_full ?? companySettings?.company_name ?? "Rock Hill Innovation Co., Ltd";

  const html = buildVendorOutgoingInvoiceHtml({
    billToAddress: buildCompanyAddress(companySettings),
    billToName,
    invoiceDate: parsed.data.invoiceDate,
    invoiceNumber: parsed.data.invoiceNumber,
    lines: lines.map((line) => ({
      amountUsd: Number(line.amount_usd),
      description: line.description,
    })),
    notes: parsed.data.notes ?? null,
    totalUsd,
    vendorAddress: vendor.address ?? null,
    vendorBanking: vendorBankingFromRecord(vendor),
    vendorCode: vendor.code,
    vendorName: vendor.name,
  });

  const pdfBuffer = await generatePdf(html);
  const fileName = `${safeFileName(`${vendor.name} - ${parsed.data.invoiceNumber}`)}.pdf`;
  const uploaded = await uploadToOneDrive({
    category: "payouts",
    fileBuffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
    tradeCode: trade.trade_id,
  });

  const generatedAt = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("payout_invoices")
    .select("id, invoice_file_id")
    .eq("trade_id", parsed.data.tradeId)
    .eq("trade_shareholder_id", parsed.data.tradeShareholderId)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message };
  }

  if (existing?.invoice_file_id) {
    await deleteFromOneDrive(existing.invoice_file_id);
  }

  const payload = {
    dividend_usd: dividendUsd,
    expense_vendor_id: shareholder.expense_vendor_id ?? null,
    generated_at: generatedAt,
    generated_by: access.user.id,
    invoice_date: parsed.data.invoiceDate,
    invoice_file_id: uploaded.fileId,
    invoice_filename: fileName,
    invoice_number: parsed.data.invoiceNumber,
    invoice_url: uploaded.webUrl,
    lines,
    notes: parsed.data.notes ?? null,
    person_name: shareholder.person_name,
  };

  const { error: writeError } = existing
    ? await supabase.from("payout_invoices").update(payload).eq("id", existing.id)
    : await supabase.from("payout_invoices").insert({
        ...payload,
        status: "outstanding",
        trade_id: parsed.data.tradeId,
        trade_shareholder_id: parsed.data.tradeShareholderId,
      });

  if (writeError) {
    return { error: writeError.message };
  }

  revalidatePath("/finance/payout");
  return { success: true, invoiceUrl: uploaded.webUrl };
}

export async function deletePayoutInvoiceDownload(payoutInvoiceId: string): Promise<ActionResult> {
  const access = await requireAdminOrController();
  if ("error" in access) return { error: access.error };

  const parsed = z.string().uuid().safeParse(payoutInvoiceId);

  if (!parsed.success) {
    return { error: "Invalid payout invoice" };
  }

  const supabase = createServerSupabaseAdmin();
  const { data: invoice, error: fetchError } = await supabase
    .from("payout_invoices")
    .select("id, invoice_file_id")
    .eq("id", parsed.data)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!invoice) return { error: "Payout invoice not found" };

  if (invoice.invoice_file_id) {
    await deleteFromOneDrive(invoice.invoice_file_id);
  }

  const { error } = await supabase
    .from("payout_invoices")
    .update({
      generated_at: null,
      invoice_file_id: null,
      invoice_filename: null,
      invoice_url: null,
    })
    .eq("id", parsed.data);

  if (error) return { error: error.message };

  revalidatePath("/finance/payout");
  return { success: true };
}

export async function updatePayoutStatus(
  payoutInvoiceId: string,
  status: "outstanding" | "paid"
): Promise<ActionResult> {
  const access = await requireAdminOrController();
  if ("error" in access) return { error: access.error };

  const parsed = z
    .object({
      payoutInvoiceId: z.string().uuid(),
      status: z.enum(["outstanding", "paid"]),
    })
    .safeParse({ payoutInvoiceId, status });

  if (!parsed.success) {
    return { error: "Invalid payout status" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase
    .from("payout_invoices")
    .update({
      status: parsed.data.status,
      status_changed_at: new Date().toISOString(),
      status_changed_by: access.user.id,
    })
    .eq("id", parsed.data.payoutInvoiceId);

  if (error) return { error: error.message };

  revalidatePath("/finance/payout");
  return { success: true };
}
