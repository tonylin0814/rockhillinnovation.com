"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { uploadToOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = { success?: true; error?: string };

type DiaryAttachment = { name: string; onedrive_url: string; file_size_bytes: number };

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

async function uploadAttachments(formData: FormData, tradeCode: string, prefix: string): Promise<DiaryAttachment[]> {
  const attachments: DiaryAttachment[] = [];

  for (let index = 0; index < 5; index += 1) {
    const file = formData.get(`${prefix}_${index}`);

    if (!(file instanceof File) || file.size === 0) {
      continue;
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadToOneDrive({
      category: "diary",
      fileBuffer,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      tradeCode,
    });

    attachments.push({
      file_size_bytes: file.size,
      name: file.name,
      onedrive_url: uploaded.webUrl,
    });
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

  const supabase = createServerSupabaseClient();
  const { data: tradeRow, error: tradeError } = await supabase
    .from("trades")
    .select("trade_id")
    .eq("id", tradeId)
    .maybeSingle();

  if (tradeError) {
    return { error: tradeError.message };
  }

  const attachments = await uploadAttachments(formData, tradeRow?.trade_id ?? "unknown", "attachment");
  const { data: entry, error } = await supabase
    .from("trade_diary_entries")
    .insert({
      attachments,
      author_id: access.user.id,
      author_name: access.user.name,
      content: content.trim(),
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
    .select("attachments")
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
    ...(await uploadAttachments(formData, tradeRow?.trade_id ?? "unknown", "new_attachment")),
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
