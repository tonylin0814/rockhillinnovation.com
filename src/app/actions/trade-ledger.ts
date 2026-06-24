"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { uploadToOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TradeLedgerEntry } from "@/types";

export type ActionResult = { success?: true; error?: string };

type EntryType = TradeLedgerEntry["entry_type"];

const FORCED_DIRECTION: Partial<Record<EntryType, "in" | "out">> = {
  client_payment_received: "in",
  supplier_payment_sent: "out",
  expense_vendor_payment: "out",
  bank_fee: "out",
};

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const entrySchema = z
  .object({
    entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    entry_type: z.enum([
      "client_payment_received",
      "supplier_payment_sent",
      "expense_vendor_payment",
      "bank_fee",
      "reimbursement",
      "misc",
    ]),
    direction: z.enum(["in", "out"]),
    amount_usd: z.coerce.number().positive().nullable().catch(null),
    amount_rmb: z.coerce.number().positive().nullable().catch(null),
    exchange_rate_id: z.string().uuid().nullable().catch(null),
    expected_amount_usd: z.coerce.number().positive().nullable().catch(null),
    reference_number: z.string().trim().nullable(),
    bank_fee_usd: z.coerce.number().min(0).catch(0),
    client_invoice_id: z.string().uuid().nullable().catch(null),
    supplier_invoice_id: z.string().uuid().nullable().catch(null),
    expense_vendor_invoice_id: z.string().uuid().nullable().catch(null),
    notes: z.string().trim().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.amount_usd == null && data.amount_rmb == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter at least one amount (USD or RMB)",
        path: ["amount_usd"],
      });
    }
  });

async function requireManager() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (user.role === "partner" || user.role === "user") {
    return { error: "Managers and admins only" };
  }

  return { user };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function uploadProofFile(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  tradeId: string,
  formData: FormData
) {
  const proofFile = formData.get("proof_file");

  if (!(proofFile instanceof File) || proofFile.size === 0) {
    return { proofFileName: null, proofOneDriveUrl: null };
  }

  const { data: tradeRow, error: tradeError } = await supabase
    .from("trades")
    .select("trade_id")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  const fileBuffer = Buffer.from(await proofFile.arrayBuffer());
  const uploaded = await uploadToOneDrive({
    category: "ledger_proof",
    fileBuffer,
    fileName: proofFile.name,
    mimeType: proofFile.type || "application/octet-stream",
    tradeCode: tradeRow?.trade_id ?? "unknown",
  });

  return { proofFileName: proofFile.name, proofOneDriveUrl: uploaded.webUrl };
}

function ledgerPayloadFromParsed(parsed: z.infer<typeof entrySchema>, direction: "in" | "out") {
  const clientInvoiceId = parsed.entry_type === "client_payment_received" ? parsed.client_invoice_id : null;
  const supplierInvoiceId = parsed.entry_type === "supplier_payment_sent" ? parsed.supplier_invoice_id : null;
  const vendorInvoiceId = parsed.entry_type === "expense_vendor_payment" ? parsed.expense_vendor_invoice_id : null;
  let bankFee = parsed.bank_fee_usd;

  if (parsed.expected_amount_usd != null && parsed.amount_usd != null) {
    const diff = Math.abs(parsed.expected_amount_usd - parsed.amount_usd);
    if (diff > 0.001) {
      bankFee = roundMoney(diff);
    }
  }

  return {
    amount_rmb: parsed.amount_rmb,
    amount_usd: parsed.amount_usd,
    bank_fee_usd: bankFee,
    client_invoice_id: clientInvoiceId,
    direction,
    entry_date: parsed.entry_date,
    entry_type: parsed.entry_type,
    exchange_rate_id: parsed.exchange_rate_id,
    expected_amount_usd: parsed.expected_amount_usd,
    expense_vendor_invoice_id: vendorInvoiceId,
    notes: parsed.notes,
    reference_number: parsed.reference_number,
    supplier_invoice_id: supplierInvoiceId,
  };
}

export async function addLedgerEntry(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const tradeIdParsed = z.string().uuid().safeParse(tradeId);

  if (!tradeIdParsed.success) {
    return { error: "Invalid trade" };
  }

  const parsed = entrySchema.safeParse({
    entry_date: formData.get("entry_date"),
    entry_type: formData.get("entry_type"),
    direction: formData.get("direction"),
    amount_usd: emptyToNull(formData.get("amount_usd")),
    amount_rmb: emptyToNull(formData.get("amount_rmb")),
    exchange_rate_id: emptyToNull(formData.get("exchange_rate_id")),
    expected_amount_usd: emptyToNull(formData.get("expected_amount_usd")),
    reference_number: emptyToNull(formData.get("reference_number")),
    bank_fee_usd: emptyToNull(formData.get("bank_fee_usd")) ?? "0",
    client_invoice_id: emptyToNull(formData.get("client_invoice_id")),
    supplier_invoice_id: emptyToNull(formData.get("supplier_invoice_id")),
    expense_vendor_invoice_id: emptyToNull(formData.get("expense_vendor_invoice_id")),
    notes: emptyToNull(formData.get("notes")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid entry" };
  }

  const direction = FORCED_DIRECTION[parsed.data.entry_type] ?? parsed.data.direction;
  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  if (!trade) {
    return { error: "Trade not found" };
  }

  const proofUpload = await uploadProofFile(supabase, tradeId, formData);

  if ("error" in proofUpload) {
    return { error: proofUpload.error };
  }

  const { data: entry, error } = await supabase
    .from("trade_ledger")
    .insert({
      ...ledgerPayloadFromParsed(parsed.data, direction),
      proof_file_name: proofUpload.proofFileName,
      proof_onedrive_url: proofUpload.proofOneDriveUrl,
      recorded_by: access.user.id,
      trade_id: tradeId,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await logActivity({
    action: "created",
    summary: "Ledger entry added",
    targetId: entry.id,
    targetTable: "trade_ledger",
    tradeId,
    user: access.user,
  });

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function updateLedgerEntry(entryId: string, tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const ids = z.object({ entryId: z.string().uuid(), tradeId: z.string().uuid() }).safeParse({ entryId, tradeId });

  if (!ids.success) {
    return { error: "Invalid IDs" };
  }

  const parsed = entrySchema.safeParse({
    amount_rmb: emptyToNull(formData.get("amount_rmb")),
    amount_usd: emptyToNull(formData.get("amount_usd")),
    bank_fee_usd: emptyToNull(formData.get("bank_fee_usd")) ?? "0",
    client_invoice_id: emptyToNull(formData.get("client_invoice_id")),
    direction: formData.get("direction"),
    entry_date: formData.get("entry_date"),
    entry_type: formData.get("entry_type"),
    exchange_rate_id: emptyToNull(formData.get("exchange_rate_id")),
    expected_amount_usd: emptyToNull(formData.get("expected_amount_usd")),
    expense_vendor_invoice_id: emptyToNull(formData.get("expense_vendor_invoice_id")),
    notes: emptyToNull(formData.get("notes")),
    reference_number: emptyToNull(formData.get("reference_number")),
    supplier_invoice_id: emptyToNull(formData.get("supplier_invoice_id")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid entry" };
  }

  const direction = FORCED_DIRECTION[parsed.data.entry_type] ?? parsed.data.direction;
  const supabase = createServerSupabaseClient();
  const proofUpload = await uploadProofFile(supabase, tradeId, formData);

  if ("error" in proofUpload) {
    return { error: proofUpload.error };
  }

  const payload: Record<string, unknown> = ledgerPayloadFromParsed(parsed.data, direction);

  if (proofUpload.proofOneDriveUrl) {
    payload.proof_onedrive_url = proofUpload.proofOneDriveUrl;
    payload.proof_file_name = proofUpload.proofFileName;
  }

  const { error } = await supabase
    .from("trade_ledger")
    .update(payload)
    .eq("id", entryId)
    .eq("trade_id", tradeId);

  if (error) {
    return { error: error.message };
  }

  await logActivity({
    action: "updated",
    summary: "Ledger entry updated",
    targetId: entryId,
    targetTable: "trade_ledger",
    tradeId,
    user: access.user,
  });

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function deleteLedgerEntry(entryId: string, tradeId: string): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({ entryId: z.string().uuid(), tradeId: z.string().uuid() })
    .safeParse({ entryId, tradeId });

  if (!parsed.success) {
    return { error: "Invalid IDs" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("trade_ledger")
    .delete()
    .eq("id", parsed.data.entryId)
    .eq("trade_id", parsed.data.tradeId);

  if (error) {
    return { error: error.message };
  }

  await logActivity({
    action: "deleted",
    summary: "Ledger entry deleted",
    targetId: entryId,
    targetTable: "trade_ledger",
    tradeId,
    user: access.user,
  });

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}
