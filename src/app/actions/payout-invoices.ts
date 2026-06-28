"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { uploadToOneDrive } from "@/lib/onedrive";
import { generatePdf } from "@/lib/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = { success?: true; error?: string };

async function requireAdminOrController() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  if (user.role !== "admin" && user.role !== "controller") {
    return { error: "Admins and controllers only" };
  }
  return { user };
}

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
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export async function generatePayoutInvoice(
  tradeId: string,
  tradeShareholderId: string
): Promise<ActionResult & { invoiceUrl?: string }> {
  const access = await requireAdminOrController();
  if ("error" in access) return { error: access.error };

  const parsed = z
    .object({
      tradeId: z.string().uuid(),
      tradeShareholderId: z.string().uuid(),
    })
    .safeParse({ tradeId, tradeShareholderId });

  if (!parsed.success) {
    return { error: "Invalid payout invoice request" };
  }

  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
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
        user_id
      )`
    )
    .eq("id", parsed.data.tradeId)
    .maybeSingle();

  if (tradeError || !trade) {
    return { error: tradeError?.message ?? "Trade not found" };
  }

  const shareholders = Array.isArray(trade.shareholders) ? trade.shareholders : [trade.shareholders];
  const shareholder = shareholders.find((item) => item?.id === parsed.data.tradeShareholderId);

  if (!shareholder) {
    return { error: "Shareholder not found" };
  }

  const bookArr = Array.isArray(trade.book) ? trade.book : [trade.book];
  const book = bookArr[0] ?? null;
  const netProfitUsd = Number(book?.net_profit_usd ?? 0);
  const bookLines = book?.lines ? (Array.isArray(book.lines) ? book.lines : [book.lines]) : [];
  const bookLine = bookLines.find((line) => line?.trade_shareholder_id === parsed.data.tradeShareholderId);
  const fallbackDividend = (netProfitUsd * Number(shareholder.split_pct ?? 0)) / 100;
  const dividendUsd = Math.round(Number(bookLine?.net_share_usd ?? fallbackDividend) * 100) / 100;

  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const refNum = `PAY-${trade.trade_id}-${datePart}-${parsed.data.tradeShareholderId.slice(-4).toUpperCase()}`;
  const invoiceDate = today.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a2e; margin: 0; padding: 0; }
        .header { background: #0d1b34; color: #fff; padding: 28px 40px 20px; }
        .header h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
        .header p { margin: 4px 0 0; font-size: 12px; opacity: 0.8; }
        .body { padding: 32px 40px; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 32px; }
        .meta-block h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px; }
        .meta-block p { margin: 0; font-size: 13px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        thead tr { background: #f4f6fb; }
        th { text-align: left; padding: 10px 14px; font-size: 11px; text-transform: uppercase; color: #555; letter-spacing: .5px; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; }
        .total-row td { font-weight: 700; font-size: 15px; background: #f8fafc; }
        .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Rock Hill Innovation</h1>
        <p>Profit Distribution Invoice</p>
      </div>
      <div class="body">
        <div class="meta">
          <div class="meta-block">
            <h3>Invoice To</h3>
            <p>${escapeHtml(shareholder.person_name)}</p>
          </div>
          <div class="meta-block" style="text-align:right">
            <h3>Invoice Reference</h3>
            <p>${escapeHtml(refNum)}</p>
            <h3 style="margin-top:12px">Date</h3>
            <p>${escapeHtml(invoiceDate)}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Trade</th>
              <th>Share %</th>
              <th style="text-align:right">Amount (USD)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Profit Distribution</td>
              <td>${escapeHtml(trade.trade_id)}</td>
              <td>${Number(shareholder.split_pct ?? 0)}%</td>
              <td style="text-align:right">${formatUsd(dividendUsd)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3">Total Payable</td>
              <td style="text-align:right">${formatUsd(dividendUsd)}</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">
          Rock Hill Innovation &nbsp;-&nbsp; This document is generated automatically and is for reference only.
        </div>
      </div>
    </body>
    </html>`;

  const pdfBuffer = await generatePdf(html);
  const fileName = `${refNum}.pdf`;
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
    .select("id")
    .eq("trade_id", parsed.data.tradeId)
    .eq("trade_shareholder_id", parsed.data.tradeShareholderId)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message };
  }

  const payload = {
    dividend_usd: dividendUsd,
    generated_at: generatedAt,
    generated_by: access.user.id,
    invoice_filename: fileName,
    invoice_url: uploaded.webUrl,
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

  const supabase = createServerSupabaseClient();
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
