"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { getNextTradeDocumentVersion } from "@/lib/document-version";
import { uploadToOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TradeDocument } from "@/types";

export type ActionResult = { success?: true; error?: string };

type DiaryAttachment = { name: string; onedrive_url: string; file_size_bytes: number };

async function requireManager() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (user.role !== "admin") {
    return { error: "Managers and admins only" };
  }

  return { user };
}

function buildAttachmentName(tradeCode: string, milestoneKey: string | null, originalName: string) {
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "");
  const safeOriginalName = originalName.replace(/[\\/:*?"<>|]/g, "-");
  const milestonePart = milestoneKey ? `_${milestoneKey}` : "";

  return `${tradeCode}${milestonePart}_${timestamp}_${safeOriginalName}`;
}

async function uploadAttachments(
  formData: FormData,
  tradeId: string,
  tradeCode: string,
  prefix: string,
  uploadedBy: string,
  milestoneKey: string | null = null
): Promise<DiaryAttachment[]> {
  const attachments: DiaryAttachment[] = [];
  const supabase = createServerSupabaseClient();
  const documentCategory: TradeDocument["document_category"] = "other";

  for (let index = 0; index < 10; index += 1) {
    const files = formData.getAll(`${prefix}_${index}`);

    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) {
        continue;
      }

      if (attachments.length >= 10) {
        return attachments;
      }

      const fileName = buildAttachmentName(tradeCode, milestoneKey, file.name);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadToOneDrive({
        category: "diary",
        fileBuffer,
        fileName,
        mimeType: file.type || "application/octet-stream",
        tradeCode,
      });
      const version = await getNextTradeDocumentVersion({
        category: documentCategory,
        supabase,
        tradeId,
      });

      await supabase.from("trade_documents").insert({
        document_category: documentCategory,
        document_type: milestoneKey ? "milestone" : "diary",
        file_name: fileName,
        file_size_bytes: file.size,
        notes: milestoneKey,
        onedrive_file_id: uploaded.fileId,
        onedrive_url: uploaded.webUrl,
        related_party: "internal",
        status: "draft",
        trade_id: tradeId,
        uploaded_by: uploadedBy,
        version,
      });

      attachments.push({
        file_size_bytes: file.size,
        name: fileName,
        onedrive_url: uploaded.webUrl,
      });
    }
  }

  return attachments;
}

export async function addDiaryEntry(tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const tradeIdParsed = z.string().uuid().safeParse(tradeId);

  if (!tradeIdParsed.success) {
    return { error: "Invalid trade" };
  }

  const content = formData.get("content");

  if (typeof content !== "string" || !content.trim()) {
    return { error: "Content is required" };
  }

  const milestoneKeyRaw = formData.get("milestone_key");
  const milestoneKey = typeof milestoneKeyRaw === "string" && milestoneKeyRaw.trim() ? milestoneKeyRaw.trim() : null;

  const supabase = createServerSupabaseClient();
  const { data: tradeRow, error: tradeError } = await supabase
    .from("trades")
    .select("trade_id")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  const attachments = await uploadAttachments(
    formData,
    tradeId,
    tradeRow?.trade_id ?? "unknown",
    "attachment",
    access.user.id,
    milestoneKey
  );
  const { data: entry, error } = await supabase
    .from("trade_diary_entries")
    .insert({
      attachments,
      author_id: access.user.id,
      author_name: access.user.name,
      content: content.trim(),
      milestone_key: milestoneKey,
      trade_id: tradeId,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await logActivity({
    action: "created",
    summary: "Diary entry added",
    targetId: entry.id,
    targetTable: "trade_diary_entries",
    tradeId,
    user: access.user,
  });

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function updateDiaryEntry(id: string, tradeId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.object({ id: z.string().uuid(), tradeId: z.string().uuid() }).safeParse({ id, tradeId });

  if (!parsed.success) {
    return { error: "Invalid IDs" };
  }

  const content = formData.get("content");

  if (typeof content !== "string" || !content.trim()) {
    return { error: "Content is required" };
  }

  const supabase = createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("trade_diary_entries")
    .select("attachments, milestone_key")
    .eq("id", id)
    .eq("trade_id", tradeId)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message };
  }

  const { data: tradeRow, error: tradeError } = await supabase
    .from("trades")
    .select("trade_id")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  let attachments = (existing?.attachments ?? []) as DiaryAttachment[];
  const removedRaw = formData.get("removed_indices");

  if (typeof removedRaw === "string" && removedRaw.trim()) {
    const removedIndices = new Set(
      removedRaw
        .split(",")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
    );
    attachments = attachments.filter((_, index) => !removedIndices.has(index));
  }

  attachments = [
    ...attachments,
    ...(await uploadAttachments(
      formData,
      tradeId,
      tradeRow?.trade_id ?? "unknown",
      "new_attachment",
      access.user.id,
      existing?.milestone_key ?? null
    )),
  ];

  const { error } = await supabase
    .from("trade_diary_entries")
    .update({
      attachments,
      content: content.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("trade_id", tradeId);

  if (error) {
    return { error: error.message };
  }

  await logActivity({
    action: "updated",
    summary: "Diary entry updated",
    targetId: id,
    targetTable: "trade_diary_entries",
    tradeId,
    user: access.user,
  });

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}

export async function deleteDiaryEntry(id: string, tradeId: string): Promise<ActionResult> {
  const access = await requireManager();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.object({ id: z.string().uuid(), tradeId: z.string().uuid() }).safeParse({ id, tradeId });

  if (!parsed.success) {
    return { error: "Invalid IDs" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("trade_diary_entries").delete().eq("id", id).eq("trade_id", tradeId);

  if (error) {
    return { error: error.message };
  }

  await logActivity({
    action: "deleted",
    summary: "Diary entry deleted",
    targetId: id,
    targetTable: "trade_diary_entries",
    tradeId,
    user: access.user,
  });

  revalidatePath(`/trades/${tradeId}`);
  return { success: true };
}
