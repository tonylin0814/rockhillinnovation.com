import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { notifyParticipants } from "@/lib/notifications";
import { uploadToOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uploadSchema = z.object({
  trade_id: z.string().uuid(),
  document_category: z.enum(["design", "shipping", "supplier_quote", "client_quotation", "invoice", "approval", "other"]),
  document_type: z.string().trim().nullable(),
  related_party: z.enum(["client", "supplier", "internal"]).nullable(),
  notes: z.string().trim().nullable(),
});

function emptyToNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "partner" || user.role === "user") {
    return NextResponse.json({ error: "Managers and admins only" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const parsed = uploadSchema.safeParse({
    trade_id: formData.get("trade_id"),
    document_category: formData.get("document_category"),
    document_type: emptyToNull(formData.get("document_type")),
    related_party: emptyToNull(formData.get("related_party")),
    notes: emptyToNull(formData.get("notes")),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid document upload" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id, trade_id")
    .eq("id", parsed.data.trade_id)
    .maybeSingle();

  if (tradeError) {
    return NextResponse.json({ error: tradeError.message }, { status: 500 });
  }

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const { fileId, webUrl } = await uploadToOneDrive({
    category: parsed.data.document_category,
    fileBuffer,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    tradeCode: trade.trade_id,
  });

  const { data, error } = await supabase
    .from("trade_documents")
    .insert({
      trade_id: parsed.data.trade_id,
      document_category: parsed.data.document_category,
      document_type: parsed.data.document_type,
      file_name: file.name,
      version: 1,
      status: "draft",
      related_party: parsed.data.related_party,
      onedrive_url: webUrl,
      onedrive_file_id: fileId,
      file_size_bytes: file.size,
      uploaded_by: user.id,
      notes: parsed.data.notes,
    })
    .select("*, uploader:users(id, name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await notifyParticipants(
    parsed.data.trade_id,
    trade.trade_id,
    user.id,
    user.name,
    `A document was uploaded on trade ${trade.trade_id}.`
  );

  return NextResponse.json({ success: true, document: data });
}
