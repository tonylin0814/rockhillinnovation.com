"use client";

import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { useState } from "react";

import { MilestoneStepDialog } from "@/components/trades/MilestoneStepDialog";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import type { MilestoneKey, TradeDiaryEntry, TradeMilestone } from "@/types";

export const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  accounting: "Accounting Close",
  client_received: "Client Received",
  deposit_invoice_sent: "Deposit Invoice Sent",
  deposit_received: "Deposit Received",
  deposit_sent: "Deposit Sent to Supplier",
  dev_first_estimate: "First Estimate Quote",
  dev_product_accepted: "New Product Accepted",
  dev_sample_design: "Sample Design & Production",
  dev_sample_shipping: "Sample Shipping",
  feedback: "Feedback",
  final_invoice_sent: "Final Invoice Sent",
  final_payment_received: "Final Payment Received",
  final_supplier_invoice: "Final Supplier Invoice",
  freight_arrangement: "Freight Arrangement",
  freight_starts: "Freight Starts",
  inquiry_received: "Inquiry Received",
  packing_strategy: "Packing Strategy",
  production_ongoing: "Production Ongoing",
  qc_arrangement: "QC Arrangement",
  qc_complete: "QC Complete",
  quotation_sent: "Quotation Sent",
  quote_received: "Supplier Quote Received",
  vendor_payment: "Vendor Payment",
};

const MILESTONE_LABELS_ZH: Record<MilestoneKey, string> = {
  accounting: "帳務結算",
  client_received: "客戶收貨",
  deposit_invoice_sent: "訂金發票已送出",
  deposit_received: "收到訂金",
  deposit_sent: "訂金已付供應商",
  dev_first_estimate: "初步估價報價",
  dev_product_accepted: "新品確認",
  dev_sample_design: "樣品設計與生產",
  dev_sample_shipping: "樣品寄送",
  feedback: "客戶回饋",
  final_invoice_sent: "尾款發票已送出",
  final_payment_received: "收到尾款",
  final_supplier_invoice: "供應商尾款發票",
  freight_arrangement: "安排貨運",
  freight_starts: "出貨開始",
  inquiry_received: "收到詢價",
  packing_strategy: "包裝規劃",
  production_ongoing: "生產進行中",
  qc_arrangement: "安排驗貨",
  qc_complete: "驗貨完成",
  quotation_sent: "客戶報價已送出",
  quote_received: "收到供應商報價",
  vendor_payment: "費用廠商付款",
};

const MILESTONE_GROUPS: { title: string; titleZh: string; items: MilestoneKey[] }[] = [
  {
    items: ["dev_sample_design", "dev_sample_shipping", "dev_first_estimate", "dev_product_accepted"],
    title: "New Product Development",
    titleZh: "新品開發",
  },
  {
    items: [
      "inquiry_received",
      "quote_received",
      "quotation_sent",
      "deposit_invoice_sent",
      "deposit_received",
      "deposit_sent",
      "production_ongoing",
      "packing_strategy",
    ],
    title: "Order - Phase 1",
    titleZh: "訂單 - 第一階段",
  },
  {
    items: [
      "final_invoice_sent",
      "final_payment_received",
      "qc_arrangement",
      "qc_complete",
      "freight_arrangement",
      "final_supplier_invoice",
      "freight_starts",
      "vendor_payment",
      "client_received",
      "feedback",
      "accounting",
    ],
    title: "Order - Phase 2",
    titleZh: "訂單 - 第二階段",
  },
];

const DEVELOPMENT_MILESTONES = MILESTONE_GROUPS[0].items;

export function getMilestoneLabel(key: MilestoneKey, language: "en" | "zh") {
  return (language === "zh" ? MILESTONE_LABELS_ZH : MILESTONE_LABELS)[key];
}

export function formatMilestoneLabel(key: MilestoneKey, language: "en" | "zh") {
  return getMilestoneLabel(key, language);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function TradeMilestoneChecklist({
  canManage,
  diaryEntries,
  milestones,
  tradeId,
}: {
  tradeId: string;
  milestones: TradeMilestone[];
  diaryEntries: TradeDiaryEntry[];
  canManage: boolean;
}) {
  const { language } = useLanguage();
  const milestoneMap = new Map(milestones.map((milestone) => [milestone.milestone, milestone]));
  const hasDevelopmentActivity = DEVELOPMENT_MILESTONES.some(
    (key) => milestoneMap.get(key)?.completed_at || diaryEntries.some((entry) => entry.milestone_key === key)
  );
  const [showDevelopment, setShowDevelopment] = useState(hasDevelopmentActivity);
  const [activeKey, setActiveKey] = useState<MilestoneKey | null>(null);
  const activeMilestone = activeKey ? milestoneMap.get(activeKey) ?? null : null;
  const activeEntries = activeKey ? diaryEntries.filter((entry) => entry.milestone_key === activeKey) : [];
  const visibleGroups = showDevelopment ? MILESTONE_GROUPS : MILESTONE_GROUPS.slice(1);
  const visibleMilestones = visibleGroups.flatMap((group) => group.items);
  const completedCount = visibleMilestones.filter((key) => milestoneMap.get(key)?.completed_at).length;
  const progressPct = Math.round((completedCount / visibleMilestones.length) * 100);
  const nextMilestone = visibleMilestones.find((key) => !milestoneMap.get(key)?.completed_at);
  const text =
    language === "zh"
      ? {
          completed: "已完成",
          currentStep: "目前步驟",
          includeDevelopment: "包含新品開發",
          noCurrentStep: "所有里程碑已完成",
          notes: "筆紀錄",
          progress: "進度",
        }
      : {
          completed: "completed",
          currentStep: "Current step",
          includeDevelopment: "Include New Product Development",
          noCurrentStep: "All milestones complete",
          notes: "notes",
          progress: "Progress",
        };

  return (
    <>
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{text.progress}</p>
              <p className="mt-1 text-2xl font-semibold text-[#0d1b34]">
                {completedCount} / {visibleMilestones.length}
                <span className="ml-2 text-sm font-medium text-slate-500">{text.completed}</span>
              </p>
            </div>
            <div className="min-w-0 sm:min-w-[260px]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{text.currentStep}</p>
              <p className="mt-1 truncate text-sm font-semibold text-[#0d1b34]">
                {nextMilestone ? getMilestoneLabel(nextMilestone, language) : text.noCurrentStep}
              </p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
              <input
                checked={showDevelopment}
                className="h-4 w-4 rounded border-slate-300 text-[#0d1b34]"
                onChange={(event) => setShowDevelopment(event.target.checked)}
                type="checkbox"
              />
              {text.includeDevelopment}
            </label>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#0d1b34] transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="space-y-3">
          {visibleGroups.map((group) => (
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm" key={group.title}>
              <div className="grid gap-0 lg:grid-cols-[150px_minmax(0,1fr)]">
                <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 lg:border-b-0 lg:border-r">
                  <h3 className="text-xs font-semibold text-[#0d1b34]">
                    {language === "zh" ? group.titleZh : group.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {group.items.filter((key) => milestoneMap.get(key)?.completed_at).length} / {group.items.length}
                  </p>
                </div>
                <div className="overflow-x-auto px-3 py-2">
                  <div className="flex min-w-max items-stretch gap-1.5">
                    {group.items.map((key, index) => {
                      const milestone = milestoneMap.get(key);
                      const done = Boolean(milestone?.completed_at);
                      const isCurrent = key === nextMilestone;
                      const notesCount = diaryEntries.filter((entry) => entry.milestone_key === key).length;

                      return (
                        <div className="flex items-center gap-2" key={key}>
                          <button
                            className={cn(
                              "group flex w-[92px] flex-col rounded-md border px-2 py-1.5 text-left transition",
                              done
                                ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
                                : isCurrent
                                  ? "border-[#0d1b34] bg-white shadow-sm hover:bg-slate-50"
                                  : "border-slate-200 bg-white hover:border-[#0d1b34]/40 hover:bg-slate-50"
                            )}
                            onClick={() => setActiveKey(key)}
                            type="button"
                          >
                            <span className="flex items-start gap-2">
                              <span
                                className={cn(
                                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                  done
                                    ? "border-emerald-500 bg-emerald-500 text-white"
                                    : isCurrent
                                      ? "border-[#0d1b34] text-[#0d1b34]"
                                      : "border-slate-300 text-slate-300 group-hover:border-[#0d1b34]/50 group-hover:text-[#0d1b34]/70"
                                )}
                              >
                                {done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                              </span>
                              <span className="min-w-0">
                                <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-[#0d1b34]">
                                  {getMilestoneLabel(key, language)}
                                </span>
                              </span>
                            </span>
                            <span className="mt-1 flex min-h-[16px] flex-wrap items-center gap-1 text-[9px] text-slate-500">
                              {done && milestone?.completed_at ? <span>{formatDate(milestone.completed_at)}</span> : null}
                              {notesCount ? (
                                <span className="rounded-full bg-white px-1 py-0.5 font-medium text-slate-600">
                                  {notesCount} {text.notes}
                                </span>
                              ) : null}
                              {isCurrent && !done ? (
                                <span className="rounded-full bg-[#0d1b34] px-1 py-0.5 font-medium text-white">
                                  {text.currentStep}
                                </span>
                              ) : null}
                            </span>
                          </button>
                          {index < group.items.length - 1 ? (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>

      {activeKey ? (
        <MilestoneStepDialog
          canManage={canManage}
          diaryEntries={activeEntries}
          label={formatMilestoneLabel(activeKey, language)}
          milestone={activeMilestone}
          milestoneKey={activeKey}
          onOpenChange={(open) => {
            if (!open) {
              setActiveKey(null);
            }
          }}
          open={Boolean(activeKey)}
          tradeId={tradeId}
        />
      ) : null}
    </>
  );
}
