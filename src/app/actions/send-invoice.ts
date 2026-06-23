"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { sendClientInvoiceEmail } from "@/lib/email";
import { downloadFromOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SendResult = { success?: true; error?: string };

export async function sendClientInvoice(invoiceId: string): Promise<SendResult> {
  const user = await getCurrentUser();

  if (!user || user.role === "partner") {
    return { error: "Access denied" };
  }

  const idParsed = z.string().uuid().safeParse(invoiceId);

  if (!idParsed.success) {
    return { error: "Invalid invoice ID" };
  }

  const supabase = createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoices")
    .select(
      "id, invoice_number, invoice_type, invoice_date, total_usd, pdf_onedrive_url, trade_id, trade:trades(trade_id, client:clients(id, name, contacts))"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  if (!invoice) {
    return { error: "Invoice not found" };
  }

  const trade = Array.isArray(invoice.trade) ? invoice.trade[0] : invoice.trade;
  const client = trade ? (Array.isArray(trade.client) ? trade.client[0] : trade.client) : null;

  if (!client) {
    return { error: "Client not found for this invoice" };
  }

  const contacts: { name: string; email: string }[] = ((client.contacts as { name?: string; email?: string }[]) ?? [])
    .filter((contact) => typeof contact.email === "string" && contact.email.trim().length > 0)
    .map((contact) => ({ email: contact.email as string, name: contact.name ?? "" }));

  if (!contacts.length) {
    return { error: "No email contacts configured for this client. Add contacts in the Clients section." };
  }

  let pdfBuffer: Buffer | undefined;

  if (invoice.pdf_onedrive_url) {
    const downloaded = await downloadFromOneDrive(invoice.pdf_onedrive_url);

    if (downloaded?.buffer) {
      pdfBuffer = downloaded.buffer;
    }
  }

  const result = await sendClientInvoiceEmail({
    clientName: client.name,
    invoiceDate: invoice.invoice_date,
    invoiceNumber: invoice.invoice_number,
    invoiceType: invoice.invoice_type as "pro_forma" | "deposit" | "final",
    pdfBuffer,
    pdfFileName: `${invoice.invoice_number}.pdf`,
    pdfWebUrl: invoice.pdf_onedrive_url,
    to: contacts,
    totalUsd: Number(invoice.total_usd),
    tradeId: trade?.trade_id ?? "",
  });

  if ("error" in result) {
    return { error: result.error };
  }

  const { error: updateError } = await supabase.from("client_invoices").update({ status: "sent" }).eq("id", invoiceId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/trades/${invoice.trade_id}`);
  return { success: true };
}
