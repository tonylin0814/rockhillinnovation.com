"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { completeMilestone, uncompleteMilestone } from "@/app/actions/trade-milestones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MilestoneKey, TradeMilestone } from "@/types";

const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  balance_received: "Balance\nReceived",
  balance_sent: "Balance\nSent",
  deposit_received: "Deposit\nReceived",
  deposit_sent: "Deposit\nSent",
  goods_shipped: "Goods\nShipped",
};

const MILESTONE_ORDER: MilestoneKey[] = [
  "deposit_received",
  "deposit_sent",
  "goods_shipped",
  "balance_received",
  "balance_sent",
];

export function TradeMilestoneChecklist({
  canManage,
  milestones,
  tradeId,
}: {
  tradeId: string;
  milestones: TradeMilestone[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<MilestoneKey | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const milestoneMap = new Map(milestones.map((milestone) => [milestone.milestone, milestone]));

  function openComplete(key: MilestoneKey) {
    setActiveKey(key);
    setNotes("");
    setError(null);
    setDialogOpen(true);
  }

  function handleConfirm() {
    if (!activeKey) {
      return;
    }

    startTransition(async () => {
      const result = await completeMilestone(tradeId, activeKey, notes || undefined);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Milestone completed");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function handleUncomplete(key: MilestoneKey) {
    startTransition(async () => {
      const result = await uncompleteMilestone(tradeId, key);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Milestone reopened");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
        {MILESTONE_ORDER.map((key, index) => {
          const milestone = milestoneMap.get(key);
          const done = Boolean(milestone?.completed_at);
          const isLast = index === MILESTONE_ORDER.length - 1;

          return (
            <div className="flex items-center sm:flex-1" key={key}>
              <button
                className={cn(
                  "flex min-w-[92px] flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors",
                  canManage ? "cursor-pointer hover:bg-slate-50" : "cursor-default"
                )}
                disabled={!canManage || pending}
                onClick={() => {
                  if (!canManage) {
                    return;
                  }

                  if (done) {
                    handleUncomplete(key);
                  } else {
                    openComplete(key);
                  }
                }}
                type="button"
              >
                {done ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <Circle className="h-6 w-6 text-slate-300" />
                )}
                <span className="whitespace-pre-line text-xs font-medium leading-tight text-slate-600">
                  {MILESTONE_LABELS[key]}
                </span>
                {done && milestone?.completed_at ? (
                  <span className="text-[10px] text-slate-400">
                    {new Date(milestone.completed_at).toLocaleDateString()}
                  </span>
                ) : null}
              </button>
              {!isLast ? <div className="mx-1 hidden h-0.5 flex-1 bg-slate-200 sm:block" /> : null}
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark {activeKey ? MILESTONE_LABELS[activeKey].replace("\n", " ") : "Milestone"} Complete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="milestone-notes">Notes</Label>
              <Textarea
                id="milestone-notes"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add a note about this milestone..."
                rows={3}
                value={notes}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} onClick={handleConfirm} type="button">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
