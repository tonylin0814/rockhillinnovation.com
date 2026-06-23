"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateVendor } from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LetterheadEditor({
  letterheadUrl,
  vendorId,
}: {
  letterheadUrl: string | null;
  vendorId: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [url, setUrl] = useState(letterheadUrl ?? "");
  const [isPending, startTransition] = useTransition();

  function saveUrl() {
    const formData = new FormData();
    formData.set("letterhead_onedrive_url", url);

    startTransition(async () => {
      const result = await updateVendor(vendorId, formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Letterhead URL saved");
      setIsEditing(false);
      router.refresh();
    });
  }

  if (isEditing) {
    return (
      <div className="space-y-3">
        <Input
          disabled={isPending}
          onChange={(event) => setUrl(event.currentTarget.value)}
          placeholder="Paste OneDrive URL"
          value={url}
        />
        <div className="flex justify-end gap-2">
          <Button disabled={isPending} onClick={() => setIsEditing(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={saveUrl}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {letterheadUrl ? (
        <Link
          className="block break-all text-sm font-medium text-blue-700 hover:underline"
          href={letterheadUrl}
          target="_blank"
        >
          {letterheadUrl}
        </Link>
      ) : (
        <p className="text-sm text-slate-500">No letterhead linked yet.</p>
      )}
      <Button onClick={() => setIsEditing(true)} type="button" variant="outline">
        {letterheadUrl ? "Update" : "Add Letterhead URL"}
      </Button>
    </div>
  );
}
