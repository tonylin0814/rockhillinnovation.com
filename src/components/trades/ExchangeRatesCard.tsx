"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveExchangeRate } from "@/app/actions/exchange-rates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExchangeRate } from "@/types";

type PaymentType = "deposit" | "final";

function formatRate(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return `\u00A5${Number(value).toFixed(4)} / $1`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function RateForm({
  existing,
  onClose,
  paymentType,
  tradeId,
}: {
  tradeId: string;
  paymentType: PaymentType;
  existing: ExchangeRate | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [refRate, setRefRate] = useState(existing?.reference_rate ? String(existing.reference_rate) : "");

  async function fetchReferenceRate() {
    setIsFetching(true);
    setError(null);

    try {
      const response = await fetch("/api/exchange-rate");
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not fetch reference rate");
        return;
      }

      setRefRate(String(data.rate));
      toast.success(`Reference rate: \u00A5${data.rate} / $1`);
    } catch {
      setError("Could not fetch reference rate");
    } finally {
      setIsFetching(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveExchangeRate(tradeId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(`${paymentType === "deposit" ? "Deposit" : "Final"} rate saved`);
      onClose();
      router.refresh();
    });
  }

  return (
    <form className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={handleSubmit}>
      <input name="payment_type" type="hidden" value={paymentType} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${paymentType}_locked_rate`}>Locked Rate</Label>
          <Input
            defaultValue={existing?.rate_rmb_per_usd ?? ""}
            disabled={isPending}
            id={`${paymentType}_locked_rate`}
            name="rate_rmb_per_usd"
            placeholder="7.2500"
            required
            step="0.0001"
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${paymentType}_rate_date`}>Rate Date</Label>
          <Input
            defaultValue={existing?.rate_date ?? todayInputValue()}
            disabled={isPending}
            id={`${paymentType}_rate_date`}
            name="rate_date"
            required
            type="date"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${paymentType}_reference_rate`}>Reference Rate</Label>
        <div className="flex gap-2">
          <Input
            disabled={isPending}
            id={`${paymentType}_reference_rate`}
            name="reference_rate"
            onChange={(event) => setRefRate(event.target.value)}
            placeholder="Optional"
            step="0.0001"
            type="number"
            value={refRate}
          />
          <Button disabled={isFetching || isPending} onClick={fetchReferenceRate} type="button" variant="outline">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${paymentType}_notes`}>Notes</Label>
        <Textarea defaultValue={existing?.notes ?? ""} disabled={isPending} id={`${paymentType}_notes`} name="notes" />
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button disabled={isPending} onClick={onClose} type="button" variant="outline">
          Cancel
        </Button>
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isPending ? "Saving..." : "Save Rate"}
        </Button>
      </div>
    </form>
  );
}

function RatePanel({
  canManage,
  existing,
  label,
  paymentType,
  tradeId,
}: {
  tradeId: string;
  paymentType: PaymentType;
  label: string;
  existing: ExchangeRate | null;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">
            {formatRate(existing?.rate_rmb_per_usd) ?? "Not set"}
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditing((value) => !value)} size="sm" variant="outline">
            {editing ? "Close" : existing ? "Edit" : "Set"}
          </Button>
        ) : null}
      </div>

      {existing ? (
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>Rate date: {formatDate(existing.rate_date)}</p>
          <p>Reference: {formatRate(existing.reference_rate) ?? "-"}</p>
          {existing.notes ? <p className="text-slate-500">{existing.notes}</p> : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No locked rate recorded yet.</p>
      )}

      {editing ? (
        <RateForm existing={existing} onClose={() => setEditing(false)} paymentType={paymentType} tradeId={tradeId} />
      ) : null}
    </div>
  );
}

function RateImpactItem({
  actualRate,
  label,
  workingExchangeRate,
}: {
  label: string;
  actualRate: ExchangeRate | null;
  workingExchangeRate: number | null;
}) {
  if (!workingExchangeRate || !actualRate?.rate_rmb_per_usd) {
    return null;
  }

  const variance = ((actualRate.rate_rmb_per_usd - workingExchangeRate) / workingExchangeRate) * 100;
  const isFavourable = variance > 0;
  const isNeutral = Math.abs(variance) < 0.005;

  return (
    <div>
      <p className="text-xs text-slate-500">Estimate &rarr; {label}</p>
      <p className="text-sm font-semibold text-[#0d1b34]">
        {formatRate(workingExchangeRate)} &rarr; {formatRate(actualRate.rate_rmb_per_usd)}
        <span className={isNeutral ? "text-slate-500" : isFavourable ? "text-green-600" : "text-red-600"}>
          {" "}
          ({variance > 0 ? "+" : ""}
          {variance.toFixed(2)}%)
        </span>
      </p>
      <p className="text-xs text-slate-500">
        {isNeutral
          ? "No meaningful movement"
          : isFavourable
            ? "Favourable - RMB weakened"
            : "Unfavourable - RMB strengthened"}
      </p>
    </div>
  );
}

function RateImpactSection({
  depositRate,
  finalRate,
  workingExchangeRate,
}: {
  depositRate: ExchangeRate | null;
  finalRate: ExchangeRate | null;
  workingExchangeRate: number | null;
}) {
  const hasDepositImpact = Boolean(workingExchangeRate && depositRate?.rate_rmb_per_usd);
  const hasFinalImpact = Boolean(workingExchangeRate && finalRate?.rate_rmb_per_usd);

  if (!hasDepositImpact && !hasFinalImpact) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rate Movement vs. Estimate</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <RateImpactItem actualRate={depositRate} label="Deposit" workingExchangeRate={workingExchangeRate} />
        <RateImpactItem actualRate={finalRate} label="Final" workingExchangeRate={workingExchangeRate} />
      </div>
    </div>
  );
}

export function ExchangeRatesCard({
  canManage,
  initialRates,
  tradeId,
  workingExchangeRate,
}: {
  tradeId: string;
  initialRates: ExchangeRate[];
  canManage: boolean;
  workingExchangeRate: number | null;
}) {
  const depositRate = initialRates.find((rate) => rate.payment_type === "deposit") ?? null;
  const finalRate = initialRates.find((rate) => rate.payment_type === "final") ?? null;

  return (
    <Card className="border-slate-200 shadow-sm lg:col-span-2">
      <CardHeader>
        <CardTitle>Exchange Rates (RMB / USD)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <RatePanel
            canManage={canManage}
            existing={depositRate}
            label="Deposit Rate"
            paymentType="deposit"
            tradeId={tradeId}
          />
          <RatePanel
            canManage={canManage}
            existing={finalRate}
            label="Final Rate"
            paymentType="final"
            tradeId={tradeId}
          />
        </div>
        <RateImpactSection
          depositRate={depositRate}
          finalRate={finalRate}
          workingExchangeRate={workingExchangeRate}
        />
      </CardContent>
    </Card>
  );
}
