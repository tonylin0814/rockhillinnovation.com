"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { createTrade } from "@/app/actions/trades";
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
import { useLanguage } from "@/context/LanguageContext";

export type TradeClientOption = {
  id: string;
  name: string;
  code: string;
};

export type TradePartnerOption = {
  id: string;
  name: string;
  email: string;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function NewTradeDialog({
  clients,
  partners,
}: {
  clients: TradeClientOption[];
  partners: TradePartnerOption[];
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("client_id", clientId);

    startTransition(async () => {
      const result = await createTrade(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(t.trades.createTrade);
      setOpen(false);

      if (result.id) {
        router.push(`/trades/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
          <Plus className="mr-2 h-4 w-4" />
          {t.trades.newTrade}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.trades.newTrade}</DialogTitle>
          <DialogDescription>{t.trades.assignPartnersHelp}</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trade_id">{t.trades.tradeId}</Label>
              <Input disabled={isPending} id="trade_id" name="trade_id" placeholder="MLP-2026-06-02" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_id">{t.trades.client}</Label>
              <Select disabled={isPending} onValueChange={setClientId} value={clientId}>
                <SelectTrigger id="client_id">
                  <SelectValue placeholder={t.trades.client} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order_number">{t.trades.orderNumber}</Label>
              <Input disabled={isPending} id="order_number" name="order_number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade_date">{t.trades.tradeDate}</Label>
              <Input
                defaultValue={todayInputValue()}
                disabled={isPending}
                id="trade_date"
                name="trade_date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="working_exchange_rate">{t.finance.exchangeRate}</Label>
              <Input
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
              <Label htmlFor="corporate_tax_rate">{t.financial.corporateTax} (%)</Label>
              <Input
                defaultValue="12"
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
            <Label htmlFor="notes">{t.table.notes}</Label>
            <Textarea disabled={isPending} id="notes" name="notes" />
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-[#0d1b34]">{t.trades.assignPartners}</p>
              <p className="text-xs text-slate-500">{t.trades.assignPartnersHelp}</p>
            </div>
            {partners.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {partners.map((partner) => (
                  <label
                    className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-[#0d1b34]"
                    key={partner.id}
                  >
                    <input
                      className="h-4 w-4 rounded border-slate-300"
                      disabled={isPending}
                      name="partner_ids"
                      type="checkbox"
                      value={partner.id}
                    />
                    <span>
                      <span className="font-medium">{partner.name}</span>
                      <span className="block text-xs text-slate-500">{partner.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t.trades.noPartners}</p>
            )}
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              {t.actions.cancel}
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending || !clientId} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t.trades.createTrade}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
