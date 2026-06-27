"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";

import { MilestoneStepDialog } from "@/components/trades/MilestoneStepDialog";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import type { MilestoneKey, TradeDiaryEntry, TradeMilestone } from "@/types";

export const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  accounting: "Accounting\nClose",
  client_received: "Client\nReceived",
  deposit_invoice_sent: "Deposit Invoice\nSent",
  deposit_received: "Deposit\nReceived",
  deposit_sent: "Deposit\nSent",
  dev_first_estimate: "First Estimate\nQuote",
  dev_product_accepted: "New Product\nAccepted",
  dev_sample_design: "Sample Design\nProduction",
  dev_sample_shipping: "Sample\nShipping",
  feedback: "Feedback",
  final_invoice_sent: "Final Invoice\nSent",
  final_payment_received: "Final Payment\nReceived",
  final_supplier_invoice: "Final Supplier\nInvoice",
  freight_arrangement: "Freight\nArrangement",
  freight_starts: "Freight\nStarts",
  inquiry_received: "Inquiry\nReceived",
  packing_strategy: "Packing\nStrategy",
  production_ongoing: "Production\nOngoing",
  qc_arrangement: "QC\nArrangement",
  qc_complete: "QC\nComplete",
  quotation_sent: "Quotation\nSent",
  quote_received: "Supplier Quote\nReceived",
  vendor_payment: "Vendor\nPayment",
};

const MILESTONE_LABELS_ZH: Record<MilestoneKey, string> = {
  accounting: "帳務\n結算",
  client_received: "客戶\n收貨",
  deposit_invoice_sent: "訂金發票\n已送出",
  deposit_received: "收到\n訂金",
  deposit_sent: "訂金已付\n供應商",
  dev_first_estimate: "初步估價\n報價",
  dev_product_accepted: "新品\n確認",
  dev_sample_design: "樣品設計\n與生產",
  dev_sample_shipping: "樣品\n寄送",
  feedback: "客戶\n回饋",
  final_invoice_sent: "尾款發票\n已送出",
  final_payment_received: "收到\n尾款",
  final_supplier_invoice: "供應商尾款\n發票",
  freight_arrangement: "安排\n貨運",
  freight_starts: "出貨\n開始",
  inquiry_received: "收到\n詢價",
  packing_strategy: "包裝\n規劃",
  production_ongoing: "生產\n進行中",
  qc_arrangement: "安排\n驗貨",
  qc_complete: "驗貨\n完成",
  quotation_sent: "客戶報價\n已送出",
  quote_received: "收到供應商\n報價",
  vendor_payment: "費用廠商\n付款",
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

export function getMilestoneLabel(key: MilestoneKey, language: "en" | "zh") {
  return (language === "zh" ? MILESTONE_LABELS_ZH : MILESTONE_LABELS)[key];
}

export function formatMilestoneLabel(key: MilestoneKey, language: "en" | "zh") {
  return getMilestoneLabel(key, language).replace(/\n/g, " ");
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

  return (
    <>
      <div className="space-y-6">
        {MILESTONE_GROUPS.map((group) => (
          <section className="space-y-3" key={group.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {language === "zh" ? group.titleZh : group.title}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {group.items.map((key) => {
                const milestone = milestoneMap.get(key);
                const done = Boolean(milestone?.completed_at);
                const notesCount = diaryEntries.filter((entry) => entry.milestone_key === key).length;

                return (
                  <button
                    className={cn(
                      "min-h-[96px] rounded-lg border bg-white p-3 text-left shadow-sm transition",
                      done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                    key={key}
                    onClick={() => setActiveKey(key)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300" />
                      )}
                      {notesCount ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          {notesCount} {language === "zh" ? "筆紀錄" : "note"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 whitespace-pre-line text-xs font-semibold leading-tight text-[#0d1b34]">
                      {getMilestoneLabel(key, language)}
                    </p>
                    {done && milestone?.completed_at ? (
                      <p className="mt-2 text-[10px] text-slate-500">
                        {new Date(milestone.completed_at).toLocaleDateString()}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
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
