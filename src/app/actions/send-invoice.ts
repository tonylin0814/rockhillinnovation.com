"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { sendClientInvoiceEmail } from "@/lib/email";
import { createOutlookDraft, downloadFromOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ClientInvoice, Contact } from "@/types";

export type SendResult = { success?: true; error?: string };
export type DraftResult = { success?: true; draftUrl?: string; error?: string };

const invoiceTypeLabels: Record<ClientInvoice["invoice_type"], string> = {
  commercial: "Commercial Invoice",
  deposit: "Deposit Invoice",
  final: "Final Invoice",
  pro_forma: "Pro-Forma Invoice",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function buildDraftEmailHtml(params: {
  clientName: string;
  contactName: string;
  invoiceDate: string;
  invoiceNumber: string;
  invoiceTypeLabel: string;
  pdfWebUrl: string | null;
  totalUsd: number;
  tradeCode: string;
}) {
  const linkSection = params.pdfWebUrl
    ? `<p style="margin:16px 0;"><a href="${escapeHtml(params.pdfWebUrl)}" style="background:#0d1b34;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Download Invoice PDF</a></p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#0d1b34;padding:24px 32px;">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">Rock Hill Innovation Inc.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(params.invoiceTypeLabel)}</p>
              <p style="margin:0 0 24px;color:#0d1b34;font-size:26px;font-weight:700;font-family:monospace;">${escapeHtml(params.invoiceNumber)}</p>

              <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
                Dear ${escapeHtml(params.contactName || "Team")},<br><br>
                Please find the ${escapeHtml(params.invoiceTypeLabel.toLowerCase())} for trade <strong>${escapeHtml(params.tradeCode)}</strong> attached for your review.
              </p>

              <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:40%;">Client</td>
                  <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#0d1b34;font-size:13px;font-weight:600;">${escapeHtml(params.clientName)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">Invoice Date</td>
                  <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#0d1b34;font-size:13px;">${escapeHtml(formatDate(params.invoiceDate))}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#64748b;font-size:13px;">Amount</td>
                  <td style="padding:12px 0;color:#0d1b34;font-size:18px;font-weight:700;">${escapeHtml(formatUsd(params.totalUsd))}</td>
                </tr>
              </table>

              ${linkSection}

              <p style="margin:24px 0 0;color:#475569;font-size:14px;line-height:1.6;">
                Best regards,<br>
                Rock Hill Innovation Inc.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendClientInvoice(invoiceId: string): Promise<SendResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
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

export async function draftClientInvoiceEmail(invoiceId: string): Promise<DraftResult> {
  try {
    const access = await requireManager();

    if ("error" in access) {
      return { error: access.error ?? "Access denied" };
    }

    const idParsed = z.string().uuid().safeParse(invoiceId);

    if (!idParsed.success) {
      return { error: "Invalid invoice ID" };
    }

    const supabase = createServerSupabaseClient();
    const { data: invoice, error: invoiceError } = await supabase
      .from("client_invoices")
      .select(
        "id, invoice_number, invoice_type, display_label, invoice_date, total_usd, pdf_onedrive_url, trade_id, trade:trades(trade_id, client:clients(id, name, contacts))"
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

    const contacts = ((client.contacts as Contact[]) ?? []).filter(
      (contact) => typeof contact.email === "string" && contact.email.trim().length > 0
    );
    const primary = contacts.find((contact) => contact.is_primary) ?? contacts[0];

    if (!primary) {
      return { error: "No email contact configured for this client." };
    }

    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name, invoice_bcc_email")
      .limit(1)
      .maybeSingle();

    let pdfBuffer: Buffer | undefined;

    if (invoice.pdf_onedrive_url) {
      const downloaded = await downloadFromOneDrive(invoice.pdf_onedrive_url);

      if (downloaded?.buffer) {
        pdfBuffer = downloaded.buffer;
      }
    }

    const typeLabel =
      invoice.display_label ??
      invoiceTypeLabels[invoice.invoice_type as ClientInvoice["invoice_type"]] ??
      "Invoice";
    const subject = `${typeLabel}: ${invoice.invoice_number} - Rock Hill Innovation`;
    const bodyHtml = buildDraftEmailHtml({
      clientName: client.name,
      contactName: primary.name || [primary.first_name, primary.last_name].filter(Boolean).join(" "),
      invoiceDate: invoice.invoice_date,
      invoiceNumber: invoice.invoice_number,
      invoiceTypeLabel: typeLabel,
      pdfWebUrl: invoice.pdf_onedrive_url,
      totalUsd: Number(invoice.total_usd),
      tradeCode: trade?.trade_id ?? "",
    });

    const bccEmail =
      typeof companySettings?.invoice_bcc_email === "string" ? companySettings.invoice_bcc_email.trim() : "";
    const draft = await createOutlookDraft({
      attachmentBuffer: pdfBuffer,
      attachmentFileName: pdfBuffer ? `${invoice.invoice_number}.pdf` : undefined,
      bcc: bccEmail ? [{ email: bccEmail, name: companySettings?.company_name ?? "Rock Hill Innovation" }] : [],
      bodyHtml,
      subject,
      to: [
        {
          email: primary.email.trim(),
          name: primary.name || [primary.first_name, primary.last_name].filter(Boolean).join(" "),
        },
      ],
    });

    if ("error" in draft) {
      return { error: draft.error };
    }

    await logActivity({
      action: "created",
      summary: `Email draft created in Outlook for invoice ${invoice.invoice_number} -> ${primary.email}`,
      targetId: invoiceId,
      targetTable: "client_invoices",
      tradeId: invoice.trade_id,
      user: access.user,
    });

    return { draftUrl: draft.webLink, success: true };
  } catch (error) {
    console.error("Outlook draft creation failed", error);
    return { error: error instanceof Error ? error.message : "Failed to create Outlook draft" };
  }
}
