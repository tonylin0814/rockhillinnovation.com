"use client";

import { FileText, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { generateCartonLabelPdf } from "@/app/actions/products";
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

export function CartonLabelButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [totalCartons, setTotalCartons] = useState("1");
  const [isPending, startTransition] = useTransition();

  function printLabel() {
    startTransition(async () => {
      const result = await generateCartonLabelPdf(productId, Number(totalCartons));

      if (result.error || !result.url) {
        toast.error(result.error ?? "Could not generate carton label");
        return;
      }

      const link = document.createElement("a");
      link.href = result.url;
      link.download = "carton-label.pdf";
      link.click();
      setOpen(false);
      toast.success("Carton label generated");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Print Carton Label
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print Carton Label</DialogTitle>
          <DialogDescription>Generate a product carton label PDF.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="total_cartons">Total Cartons</Label>
            <Input
              disabled={isPending}
              id="total_cartons"
              min="1"
              onChange={(event) => setTotalCartons(event.target.value)}
              step="1"
              type="number"
              value={totalCartons}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={printLabel} type="button">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Generate PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
