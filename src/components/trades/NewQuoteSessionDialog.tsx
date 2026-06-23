"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { createQuoteSession } from "@/app/actions/supplier-quotes";
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
import type { SupplierQuoteSession } from "@/types";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function NewQuoteSessionDialog({ tradeId }: { tradeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recordedBy, setRecordedBy] = useState<SupplierQuoteSession["recorded_by"]>("manual");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("recorded_by", recordedBy);

    startTransition(async () => {
      const result = await createQuoteSession(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Quote session created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
          <Plus className="mr-2 h-4 w-4" />
          New Quote Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Quote Session</DialogTitle>
          <DialogDescription>Create a supplier quote round for this trade.</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="quote_date">Quote Date</Label>
            <Input
              defaultValue={todayInputValue()}
              disabled={isPending}
              id="quote_date"
              name="quote_date"
              required
              type="date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recorded_by">Recorded By</Label>
            <Select
              disabled={isPending}
              onValueChange={(value: SupplierQuoteSession["recorded_by"]) => setRecordedBy(value)}
              value={recordedBy}
            >
              <SelectTrigger id="recorded_by">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="chatgpt">ChatGPT</SelectItem>
                <SelectItem value="judy">Judy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea disabled={isPending} id="notes" name="notes" />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Session
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
