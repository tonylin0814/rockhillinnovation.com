"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateTradeParticipants } from "@/app/actions/trades";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { TradePartnerOption } from "./NewTradeDialog";

export function ManagePartnersDialog({
  initialPartnerIds,
  partners,
  tradeId,
  trigger,
}: {
  tradeId: string;
  partners: TradePartnerOption[];
  initialPartnerIds: string[];
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState(initialPartnerIds);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setError(null);
      setSelectedPartnerIds(initialPartnerIds);
    }
  }, [initialPartnerIds, open]);

  function togglePartner(partnerId: string) {
    setSelectedPartnerIds((currentIds) =>
      currentIds.includes(partnerId)
        ? currentIds.filter((id) => id !== partnerId)
        : [...currentIds, partnerId]
    );
  }

  function handleSave() {
    setError(null);

    startTransition(async () => {
      const result = await updateTradeParticipants(tradeId, selectedPartnerIds);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Trade partners updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Manage Partners</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage Partners</DialogTitle>
          <DialogDescription>Choose which project partners can view this trade.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {partners.length ? (
            <div className="grid gap-2">
              {partners.map((partner) => (
                <label
                  className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-[#0d1b34]"
                  key={partner.id}
                >
                  <input
                    checked={selectedPartnerIds.includes(partner.id)}
                    className="h-4 w-4 rounded border-slate-300"
                    disabled={isPending}
                    onChange={() => togglePartner(partner.id)}
                    type="checkbox"
                  />
                  <span>
                    <span className="font-medium">{partner.name}</span>
                    <span className="block text-xs text-slate-500">{partner.email}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No project partners added yet.</p>
          )}

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={handleSave} type="button">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Partners
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
