"use client";

import { CheckCircle2, Circle, Clock3 } from "lucide-react";
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

const ALL_MILESTONES = MILESTONE_GROUPS.flatMap((group) => group.items);

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
  const [activeKey, setActiveKey] = useState<MilestoneKey | null>(null);
  const milestoneMap = new Map(milestones.map((milestone) => [milestone.milestone, milestone]));
  const activeMilestone = activeKey ? milestoneMap.get(activeKey) ?? null : null;
  const activeEntries = activeKey ? diaryEntries.filter((entry) => entry.milestone_key === activeKey) : [];
  const completedCount = ALL_MILESTONES.filter((key) => milestoneMap.get(key)?.completed_at).length;
  const progressPct = Math.round((completedCount / ALL_MILESTONES.length) * 100);
  const nextMilestone = ALL_MILESTONES.find((key) => !milestoneMap.get(key)?.completed_at);
  const text =
    language === "zh"
      ? {
          completed: "已完成",
          currentStep: "目前步驟",
          noCurrentStep: "所有里程碑已完成",
          notes: "筆紀錄",
          openStep: "開啟步驟",
          progress: "進度",
        }
      : {
          completed: "completed",
          currentStep: "Current step",
          noCurrentStep: "All milestones complete",
          notes: "notes",
          openStep: "Open step",
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
                {completedCount} / {ALL_MILESTONES.length}
                <span className="ml-2 text-sm font-medium text-slate-500">{text.completed}</span>
              </p>
            </div>
            <div className="min-w-0 sm:min-w-[260px]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{text.currentStep}</p>
              <p className="mt-1 truncate text-sm font-semibold text-[#0d1b34]">
                {nextMilestone ? getMilestoneLabel(nextMilestone, language) : text.noCurrentStep}
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#0d1b34] transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="space-y-4">
          {MILESTONE_GROUPS.map((group) => (
            <section className="rounded-lg border border-slate-200 bg-white" key={group.title}>
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-[#0d1b34]">
                  {language === "zh" ? group.titleZh : group.title}
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {group.items.map((key) => {
                  const milestone = milestoneMap.get(key);
                  const done = Boolean(milestone?.completed_at);
                  const notesCount = diaryEntries.filter((entry) => entry.milestone_key === key).length;

                  return (
                    <button
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      key={key}
                      onClick={() => setActiveKey(key)}
                      type="button"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
                          done
                            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                            : "border-slate-200 bg-white text-slate-300 group-hover:border-[#0d1b34] group-hover:text-[#0d1b34]"
                        )}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#0d1b34]">
                          {getMilestoneLabel(key, language)}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {done && milestone?.completed_at ? <span>{formatDate(milestone.completed_at)}</span> : null}
                          {done && milestone?.completed_by ? <span>{milestone.completed_by}</span> : null}
                          {notesCount ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                              {notesCount} {text.notes}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="hidden items-center gap-1 text-xs font-medium text-slate-400 transition group-hover:text-[#0d1b34] sm:inline-flex">
                        <Clock3 className="h-3.5 w-3.5" />
                        {text.openStep}
                      </span>
                    </button>
                  );
                })}
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
