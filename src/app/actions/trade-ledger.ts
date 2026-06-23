"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
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

  if (user.role === "partner") {
    return { error: "Managers and admins only" };
  }

  return { user };
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
  const clientInvoiceId =
    parsed.data.entry_type === "client_payment_received" ? parsed.data.client_invoice_id : null;
  const supplierInvoiceId =
    parsed.data.entry_type === "supplier_payment_sent" ? parsed.data.supplier_invoice_id : null;
  const vendorInvoiceId =
    parsed.data.entry_type === "expense_vendor_payment" ? parsed.data.expense_vendor_invoice_id : null;

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

  const { error } = await supabase.from("trade_ledger").insert({
    amount_rmb: parsed.data.amount_rmb,
    amount_usd: parsed.data.amount_usd,
    bank_fee_usd: parsed.data.bank_fee_usd,
    client_invoice_id: clientInvoiceId,
    direction,
    entry_date: parsed.data.entry_date,
    entry_type: parsed.data.entry_type,
    exchange_rate_id: parsed.data.exchange_rate_id,
    expense_vendor_invoice_id: vendorInvoiceId,
    notes: parsed.data.notes,
    recorded_by: access.user.id,
    reference_number: parsed.data.reference_number,
    supplier_invoice_id: supplierInvoiceId,
    trade_id: tradeId,
  });

  if (error) {
    return { error: error.message };
  }

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

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}
