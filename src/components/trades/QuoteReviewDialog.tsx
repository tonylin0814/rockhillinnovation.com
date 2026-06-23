"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { reviewQuoteSession } from "@/app/actions/quote-review";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function QuoteReviewDialog({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen && !review && !isPending) {
      startTransition(async () => {
        const result = await reviewQuoteSession(sessionId);

        if ("error" in result) {
          toast.error(result.error);
          setOpen(false);
          return;
        }

        setReview(result.review);
      });
    }
  }

  function verdictClass(text: string) {
    const first = text.trim().split(/\s/)[0]?.toUpperCase() ?? "";

    if (first === "ACCEPT") {
      return "border-green-200 bg-green-50 text-green-700";
    }

    if (first === "NEGOTIATE") {
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    }

    return "border-red-200 bg-red-50 text-red-700";
  }

  const firstLine = review?.split("\n")[0]?.trim() ?? "";
  const bodyText = review?.split("\n").slice(1).join("\n").trim() ?? "";

  return (
    <Dialog onOpenChange={handleOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          <Sparkles className="mr-2 h-4 w-4" />
          Review with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Quote Review</DialogTitle>
        </DialogHeader>

        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : review ? (
          <div className="space-y-4">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${verdictClass(firstLine)}`}
            >
              {firstLine}
            </span>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{bodyText}</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
