import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PnlScenario = {
  costUsd: number;
  margin: number;
  marginPct: number | null;
} | null;

function formatMoney(value: number | null, prefix = "$") {
  if (value == null) {
    return "-";
  }

  return `${prefix}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

function formatPercent(value: number | null) {
  if (value == null) {
    return "";
  }

  return ` (${value >= 0 ? "+" : ""}${value.toFixed(1)}%)`;
}

function marginClass(margin: number | null) {
  if (margin == null) {
    return "text-slate-500";
  }

  return margin >= 0 ? "text-green-700" : "text-red-700";
}

function ScenarioRow({
  label,
  rateLabel,
  scenario,
}: {
  label: string;
  rateLabel: string | null;
  scenario: PnlScenario;
}) {
  if (!scenario) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-slate-500">
        {label}
        {rateLabel ? <span className="ml-1 text-slate-400">@ {rateLabel}</span> : null}
      </p>
      <p className={`text-sm font-semibold ${marginClass(scenario.margin)}`}>
        {formatMoney(scenario.margin)}
        {formatPercent(scenario.marginPct)}
      </p>
      <p className="text-xs text-slate-400">Cost basis: {formatMoney(scenario.costUsd)}</p>
    </div>
  );
}

export function TradePnlCard({
  absorbedDevCostCad,
  absorbedDevCostRmb,
  absorbedDevCostUsd,
  costRmb,
  depositPnl,
  depositRateValue,
  finalPnl,
  finalRateValue,
  revenueUsd,
  workingPnl,
  workingRateValue,
}: {
  revenueUsd: number | null;
  costRmb: number | null;
  absorbedDevCostRmb: number;
  absorbedDevCostCad: number;
  absorbedDevCostUsd: number;
  workingPnl: PnlScenario;
  depositPnl: PnlScenario;
  finalPnl: PnlScenario;
  workingRateValue: number | null;
  depositRateValue: number | null;
  finalRateValue: number | null;
}) {
  function rateLabel(rate: number | null) {
    return rate ? `\u00A5${rate.toFixed(4)}/$1` : null;
  }

  const hasDevCosts = absorbedDevCostRmb > 0 || absorbedDevCostCad > 0 || absorbedDevCostUsd > 0;

  return (
    <Card className="border-slate-200 shadow-sm lg:col-span-2">
      <CardHeader>
        <CardTitle>P&amp;L Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Revenue (Accepted Quote)
            </p>
            {revenueUsd != null ? (
              <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">{formatMoney(revenueUsd)}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No accepted quotation yet</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Supplier Cost (Confirmed Quote)
            </p>
            {costRmb != null ? (
              <p className="mt-2 text-2xl font-semibold text-[#0d1b34]">{formatMoney(costRmb, "\u00A5")}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No confirmed supplier quote yet</p>
            )}
          </div>
        </div>

        {workingPnl || depositPnl || finalPnl ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Gross Margin</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <ScenarioRow label="At Working Rate" rateLabel={rateLabel(workingRateValue)} scenario={workingPnl} />
              <ScenarioRow label="At Deposit Rate" rateLabel={rateLabel(depositRateValue)} scenario={depositPnl} />
              <ScenarioRow label="At Final Rate" rateLabel={rateLabel(finalRateValue)} scenario={finalPnl} />
            </div>
          </div>
        ) : null}

        {hasDevCosts ? (
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Absorbed Development Costs (not in margin above)
            </p>
            <p className="text-sm text-amber-900">
              {absorbedDevCostRmb > 0 ? `\u00A5${absorbedDevCostRmb.toFixed(2)} ` : ""}
              {absorbedDevCostCad > 0 ? `CA$${absorbedDevCostCad.toFixed(2)} ` : ""}
              {absorbedDevCostUsd > 0 ? `$${absorbedDevCostUsd.toFixed(2)}` : ""}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
