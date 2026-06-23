"use client";

import { ImageIcon, Loader2, Upload } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductImage } from "@/types";

const imageSlotCount = 5;

function normalizeImages(images: ProductImage[] | null | undefined): ProductImage[] {
  return Array.from({ length: imageSlotCount }, (_, index) => ({
    file_id: images?.[index]?.file_id ?? null,
    file_name: images?.[index]?.file_name ?? null,
    name: images?.[index]?.name ?? "",
    url: images?.[index]?.url?.includes("mock.sharepoint.com") ? null : images?.[index]?.url ?? null,
  }));
}

export function ProductImagesEditor({
  initialImages,
  productId,
}: {
  initialImages: ProductImage[] | null | undefined;
  productId: string;
}) {
  const [images, setImages] = useState<ProductImage[]>(() => normalizeImages(initialImages));
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const slots = useMemo(() => normalizeImages(images), [images]);

  function updateName(index: number, name: string) {
    setImages((current) => {
      const next = normalizeImages(current);
      next[index] = { ...next[index], name };
      return next;
    });
  }

  function updateFile(index: number, event: ChangeEvent<HTMLInputElement>) {
    setFiles((current) => ({ ...current, [index]: event.currentTarget.files?.[0] ?? null }));
  }

  function saveSlot(index: number) {
    const formData = new FormData();
    const file = files[index];

    formData.set("product_id", productId);
    formData.set("slot_index", String(index));
    formData.set("image_name", slots[index].name);

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

        setImages(normalizeImages(result.images));
        setFiles((current) => ({ ...current, [index]: null }));
        toast.success("Product image saved");
      } finally {
        setSavingSlot(null);
      }
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {slots.map((image, index) => (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4" key={index}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#0d1b34]">Image {index + 1}</p>
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
          </div>

          <div className="relative flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50">
            {image.url ? (
              <Image
                alt={image.name || image.file_name || `Product image ${index + 1}`}
                className="rounded-md object-contain"
                fill
                sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
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
            {savingSlot === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Save Image
          </Button>
        </div>
      ))}
    </div>
  );
}
