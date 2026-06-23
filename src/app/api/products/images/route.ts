import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { uploadProductImageToOneDrive } from "@/lib/onedrive";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProductImage } from "@/types";

export const runtime = "nodejs";

const imageSlotCount = 5;

const uploadSchema = z.object({
  product_id: z.string().uuid(),
  slot_index: z.coerce.number().int().min(0).max(imageSlotCount - 1),
  image_name: z.string().trim().nullable(),
});

function emptyToNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeImages(images: unknown): ProductImage[] {
  const existing = Array.isArray(images) ? images : [];
  return Array.from({ length: imageSlotCount }, (_, index) => {
    const image = existing[index] as Partial<ProductImage> | undefined;
    const url = image?.url?.includes("mock.sharepoint.com") ? null : image?.url ?? null;

    return {
      file_id: image?.file_id ?? null,
      file_name: image?.file_name ?? null,
      name: image?.name ?? "",
      url,
    };
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role === "partner") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const formData = await request.formData();
  const parsed = uploadSchema.safeParse({
    image_name: emptyToNull(formData.get("image_name")),
    product_id: formData.get("product_id"),
    slot_index: formData.get("slot_index"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid image upload" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, code, product_images")
    .eq("id", parsed.data.product_id)
    .maybeSingle();

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const images = normalizeImages(product.product_images);
  const slot = images[parsed.data.slot_index];
  const file = formData.get("file");

  slot.name = parsed.data.image_name ?? slot.name;

  if (file instanceof File && file.size) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let uploadResult: { fileId: string; webUrl: string };

    try {
      uploadResult = await uploadProductImageToOneDrive({
        fileBuffer: Buffer.from(arrayBuffer),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        productCode: product.code,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not upload image to OneDrive";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    slot.file_id = uploadResult.fileId;
    slot.file_name = file.name;
    slot.url = uploadResult.webUrl;
  }

  images[parsed.data.slot_index] = slot;

  const { error: updateError } = await supabase
    .from("products")
    .update({ product_images: images })
    .eq("id", parsed.data.product_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, images });
}
