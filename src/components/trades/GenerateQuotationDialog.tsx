"use client";

import { FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateQuotationPdf } from "@/app/actions/client-quotations";
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
import { Textarea } from "@/components/ui/textarea";

export function GenerateQuotationDialog({
  children,
  defaultRef,
  sessionId,
}: {
  sessionId: string;
  children: ReactNode;
  defaultRef?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await generateQuotationPdf(sessionId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Quotation PDF generated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Quotation PDF</DialogTitle>
          <DialogDescription>Create a branded PDF quotation to send to the client.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="quotation_ref">Order Number</Label>
            <Input
              defaultValue={defaultRef ?? ""}
              disabled={isPending}
              id="quotation_ref"
              name="quotation_ref"
              placeholder="e.g. MLP-Q-001"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valid_until">Valid Until</Label>
            <Input disabled={isPending} id="valid_until" name="valid_until" type="date" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quotation_notes">Notes</Label>
            <Textarea
              disabled={isPending}
              id="quotation_notes"
              name="notes"
              placeholder="Any additional notes for this quotation..."
              rows={3}
            />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              {isPending ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
