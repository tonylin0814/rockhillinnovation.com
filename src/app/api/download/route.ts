import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { downloadFromOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function hasReadableFileReference(fileUrl: string) {
  const supabase = createServerSupabaseClient();

  const directChecks = [
    supabase.from("trade_documents").select("id").eq("onedrive_url", fileUrl).limit(1).maybeSingle(),
    supabase.from("client_invoices").select("id").eq("pdf_onedrive_url", fileUrl).limit(1).maybeSingle(),
    supabase.from("supplier_invoices_outgoing").select("id").eq("pdf_onedrive_url", fileUrl).limit(1).maybeSingle(),
    supabase.from("expense_vendor_invoices").select("id").eq("pdf_onedrive_url", fileUrl).limit(1).maybeSingle(),
    supabase.from("payout_invoices").select("id").eq("invoice_file_url", fileUrl).limit(1).maybeSingle(),
    supabase.from("trade_ledger").select("id").eq("proof_onedrive_url", fileUrl).limit(1).maybeSingle(),
    supabase.from("trade_development_versions").select("id").eq("file_onedrive_url", fileUrl).limit(1).maybeSingle(),
  ];

  for (const check of directChecks) {
    const { data, error } = await check;
    if (error) continue;
    if (data) return true;
  }

  const { data: diaryEntry } = await supabase
    .from("trade_diary_entries")
    .select("id")
    .contains("attachments", [{ onedrive_url: fileUrl }])
    .limit(1)
    .maybeSingle();

  if (diaryEntry) return true;

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .contains("product_images", [{ url: fileUrl }])
    .limit(1)
    .maybeSingle();

  return Boolean(product);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fileUrl = searchParams.get("url");
  const filename = searchParams.get("name") ?? "document.pdf";

  if (!fileUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const decodedFileUrl = decodeURIComponent(fileUrl);

  if (!decodedFileUrl.startsWith("https://")) {
    return new NextResponse("Invalid url parameter", { status: 400 });
  }

  const canRead = await hasReadableFileReference(decodedFileUrl);

  if (!canRead) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const result = await downloadFromOneDrive(decodedFileUrl);

  if (!result) {
    return new NextResponse("File not found or unavailable", { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Content-Type": result.mimeType,
    },
  });
}
