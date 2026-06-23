import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { uploadToOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uploadSchema = z.object({
  trade_id: z.string().uuid(),
  trade_code: z.string().min(1),
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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const parsed = uploadSchema.safeParse({
    trade_id: formData.get("trade_id"),
    trade_code: formData.get("trade_code"),
    document_category: formData.get("document_category"),
    document_type: emptyToNull(formData.get("document_type")),
    related_party: emptyToNull(formData.get("related_party")),
    notes: emptyToNull(formData.get("notes")),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid document upload" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const { fileId, webUrl } = await uploadToOneDrive({
    category: parsed.data.document_category,
    fileBuffer,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    tradeCode: parsed.data.trade_code,
  });

  const supabase = createServerSupabaseClient();
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

  return NextResponse.json({ success: true, document: data });
}
