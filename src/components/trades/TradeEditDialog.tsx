"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateTrade } from "@/app/actions/trades";
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
import type { Trade } from "@/types";
import type { TradeClientOption } from "./NewTradeDialog";

export function TradeEditDialog({
  clients,
  trade,
  trigger,
}: {
  trade: Trade;
  clients: TradeClientOption[];
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(trade.client_id);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setError(null);
      setClientId(trade.client_id);
    }
  }, [open, trade.client_id]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("client_id", clientId);

    startTransition(async () => {
      const result = await updateTrade(trade.id, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Trade updated successfully");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Edit</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Trade</DialogTitle>
          <DialogDescription>Update the core trade details.</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trade_id">Trade ID</Label>
              <Input defaultValue={trade.trade_id} disabled={isPending} id="trade_id" name="trade_id" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_id">Client</Label>
              <Select disabled={isPending} onValueChange={setClientId} value={clientId}>
                <SelectTrigger id="client_id">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} ({client.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order_number">Order Number</Label>
              <Input defaultValue={trade.order_number ?? ""} disabled={isPending} id="order_number" name="order_number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade_date">Trade Date</Label>
              <Input
                defaultValue={trade.trade_date}
                disabled={isPending}
                id="trade_date"
                name="trade_date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="working_exchange_rate">Working Exchange Rate</Label>
              <Input
                defaultValue={trade.working_exchange_rate ?? ""}
                disabled={isPending}
                id="working_exchange_rate"
                min="0"
                name="working_exchange_rate"
                placeholder="e.g. 7.25"
                step="0.0001"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="corporate_tax_rate">Corporate Tax Rate (%)</Label>
              <Input
                defaultValue={(trade.corporate_tax_rate * 100).toString()}
                disabled={isPending}
                id="corporate_tax_rate"
                min="0"
                name="corporate_tax_rate"
                step="0.01"
                type="number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={trade.notes ?? ""} disabled={isPending} id="notes" name="notes" />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending || !clientId} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
