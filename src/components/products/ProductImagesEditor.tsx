"use client";

import { ImageIcon, Loader2, Plus, Upload, X } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductImage } from "@/types";

type ProductImageSlot = ProductImage & { _key: string };

function emptyImage(): ProductImage {
  return {
    file_id: null,
    file_name: null,
    name: "",
    url: null,
  };
}

function createImageSlot(image?: ProductImage): ProductImageSlot {
  return {
    ...(image ?? emptyImage()),
    _key: crypto.randomUUID(),
  };
}

function normalizeImages(images: ProductImage[] | null | undefined): ProductImage[] {
  const cleaned = (images ?? [])
    .map((image) => ({
      file_id: image?.file_id ?? null,
      file_name: image?.file_name ?? null,
      name: image?.name ?? "",
      url: image?.url?.includes("mock.sharepoint.com") ? null : image?.url ?? null,
    }))
    .filter((image) => image.file_id || image.file_name || image.name || image.url);

  return cleaned.length ? cleaned : [emptyImage()];
}

export function ProductImagesEditor({
  canManage = true,
  initialImages,
  productId,
}: {
  canManage?: boolean;
  initialImages: ProductImage[] | null | undefined;
  productId: string;
}) {
  const [imageSlots, setImageSlots] = useState<ProductImageSlot[]>(() =>
    normalizeImages(initialImages).map(createImageSlot)
  );
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [removingSlot, setRemovingSlot] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  function updateName(index: number, name: string) {
    setImageSlots((current) => {
      const next = current.length ? [...current] : [createImageSlot()];
      next[index] = { ...next[index], name };
      return next;
    });
  }

  function updateFile(index: number, event: ChangeEvent<HTMLInputElement>) {
    setFiles((current) => ({ ...current, [index]: event.currentTarget.files?.[0] ?? null }));
  }

  function addImage() {
    setImageSlots((current) => [...current, createImageSlot()]);
  }

  function saveSlot(index: number) {
    const formData = new FormData();
    const file = files[index];

    formData.set("action", "save");
    formData.set("product_id", productId);
    formData.set("slot_index", String(index));
    formData.set("image_name", imageSlots[index].name);

    if (file) {
      formData.set("file", file);
    }

    setSavingSlot(index);
    startTransition(async () => {
      try {
        const response = await fetch("/api/products/images", {
          body: formData,
          method: "POST",
        });
        const result = await response.json();

        if (!response.ok || result.error) {
          toast.error(result.error ?? "Could not save image");
          return;
        }

        const nextImages = normalizeImages(result.images);
        setImageSlots(nextImages.map(createImageSlot));
        setFiles((current) => ({ ...current, [index]: null }));
        toast.success("Product image saved");
      } finally {
        setSavingSlot(null);
      }
    });
  }

  function removeSlot(index: number) {
    const formData = new FormData();

    formData.set("action", "remove");
    formData.set("product_id", productId);
    formData.set("slot_index", String(index));
    formData.set("image_name", "");

    setRemovingSlot(index);
    startTransition(async () => {
      try {
        const response = await fetch("/api/products/images", {
          body: formData,
          method: "POST",
        });
        const result = await response.json();

        if (!response.ok || result.error) {
          toast.error(result.error ?? "Could not remove image");
          return;
        }

        const nextImages = normalizeImages(result.images);
        setImageSlots(nextImages.map(createImageSlot));
        setFiles((current) => {
          const next = { ...current };
          delete next[index];
          return next;
        });
        toast.success("Product image removed");
      } finally {
        setRemovingSlot(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex items-center justify-end">
          <Button disabled={isPending} onClick={addImage} size="sm" type="button" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Image
          </Button>
        </div>
      ) : null}

      <div className="space-y-4">
        {imageSlots.map((image, index) => (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4" key={image._key}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#0d1b34]">Image {index + 1}</p>
              <div className="flex items-center gap-2">
                {image.url ? (
                  <a
                    className="text-xs font-medium text-blue-700 hover:underline"
                    href={image.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open
                  </a>
                ) : null}
                {canManage && index > 0 ? (
                  <Button
                    disabled={isPending}
                    onClick={() => removeSlot(index)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    {removingSlot === index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="relative flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50">
              {image.url ? (
                <Image
                  alt={image.name || image.file_name || `Product image ${index + 1}`}
                  className="rounded-md object-contain"
                  fill
                  sizes="(min-width: 1024px) 22vw, 90vw"
                  src={`/api/products/images/preview?url=${encodeURIComponent(image.url)}`}
                  unoptimized
                />
              ) : (
                <div className="text-center text-slate-500">
                  <ImageIcon className="mx-auto h-8 w-8" />
                  <p className="mt-2 text-xs">{image.file_name ?? "No image uploaded"}</p>
                </div>
              )}
            </div>

            {canManage ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`product-image-name-${index}`}>Image Name</Label>
                  <Input
                    disabled={isPending}
                    id={`product-image-name-${index}`}
                    onChange={(event) => updateName(index, event.currentTarget.value)}
                    placeholder="Front view, packaging, label..."
                    value={image.name}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`product-image-file-${index}`}>Upload Image</Label>
                  <Input
                    accept="image/*"
                    disabled={isPending}
                    id={`product-image-file-${index}`}
                    onChange={(event) => updateFile(index, event)}
                    type="file"
                  />
                </div>

                <Button disabled={isPending} onClick={() => saveSlot(index)} type="button" variant="outline">
                  {savingSlot === index ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Save Image
                </Button>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
