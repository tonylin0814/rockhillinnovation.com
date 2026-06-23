"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TradeDocument } from "@/types";

type RelatedPartyValue = "none" | "client" | "supplier" | "internal";

const categoryLabels: Record<TradeDocument["document_category"], string> = {
  design: "Design",
  supplier_quote: "Supplier Quote",
  client_quotation: "Client Quotation",
  invoice: "Invoice",
  shipping: "Shipping",
  approval: "Approval",
  other: "Other",
};

export function UploadDocumentDialog({
  tradeCode,
  tradeId,
}: {
  tradeId: string;
  tradeCode: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<TradeDocument["document_category"]>("design");
  const [relatedParty, setRelatedParty] = useState<RelatedPartyValue>("none");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsUploading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("trade_id", tradeId);
    formData.set("trade_code", tradeCode);
    formData.set("document_category", category);

    if (relatedParty === "none") {
      formData.delete("related_party");
    } else {
      formData.set("related_party", relatedParty);
    }

    try {
      const response = await fetch("/api/documents/upload", {
        body: formData,
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to upload document");
      }

      toast.success("Document uploaded");
      setOpen(false);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to upload document");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>Add a file to this trade document library.</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input disabled={isUploading} id="file" name="file" required type="file" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document_category">Category</Label>
            <Select
              disabled={isUploading}
              onValueChange={(value: TradeDocument["document_category"]) => setCategory(value)}
              value={category}
            >
              <SelectTrigger id="document_category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="document_type">Document Type</Label>
            <Input disabled={isUploading} id="document_type" name="document_type" placeholder="packing_list" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="related_party">Related Party</Label>
            <Select
              disabled={isUploading}
              onValueChange={(value: RelatedPartyValue) => setRelatedParty(value)}
              value={relatedParty}
            >
              <SelectTrigger id="related_party">
                <SelectValue placeholder="Select related party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea disabled={isUploading} id="notes" name="notes" />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isUploading} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isUploading} type="submit">
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
