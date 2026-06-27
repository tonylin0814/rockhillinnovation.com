"use client";

import { CheckCircle2, Download, FileText, PencilLine, RotateCcw, Send, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateQuotationSessionStatus } from "@/app/actions/client-quotations";
import { useLanguage } from "@/context/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildDownloadUrl } from "@/lib/download";
import type { ClientQuotationLine, ClientQuotationSession } from "@/types";
import { GenerateQuotationDialog } from "./GenerateQuotationDialog";
import { NewQuotationSessionDialog } from "./NewQuotationSessionDialog";
import { QuotationLinesEditor } from "./QuotationLinesEditor";

type ProductOption = {
  id: string;
  code: string;
  supplier_product_code: string | null;
  name_english: string;
  product_type: "part" | "set";
  latest_cost_rmb?: number | null;
  previous_quote_date?: string | null;
  previous_quote_trade_id?: string | null;
  previous_quote_usd?: number | null;
};

type LoadedQuotationLines = {
  lines: ClientQuotationLine[];
  products: ProductOption[];
};

const statusClasses: Record<ClientQuotationSession["status"], string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
  accepted: "border-green-200 bg-green-50 text-green-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: ClientQuotationSession["status"] }) {
  const { t } = useLanguage();
  return (
    <Badge className={statusClasses[status]} variant="outline">
      {t.status[status as keyof typeof t.status] ?? status}
    </Badge>
  );
}

export function ClientQuotationsTab({
  canManage,
  initialSessions,
  tradeId,
  workingExchangeRate,
}: {
  tradeId: string;
  initialSessions: ClientQuotationSession[];
  canManage: boolean;
  workingExchangeRate: number | null;
}) {
  const { language } = useLanguage();
  const text = language === "zh"
    ? {
        accepted: "標記為已接受",
        client: "客戶",
        description: "建立、審核並管理此交易的客戶報價輪次。",
        downloadPdf: "下載 PDF",
        edit: "編輯",
        generatePdf: "產生 PDF",
        hideLines: "隱藏明細",
        rejected: "標記為已拒絕",
        regeneratePdf: "重新產生 PDF",
        revert: "轉回草稿",
        round: "第 {round} 輪",
        sent: "標記為已寄出",
        title: "客戶報價輪次",
        viewLines: "查看明細",
      }
    : {
        accepted: "Mark Accepted",
        client: "Client",
        description: "Create, review, and manage quotation sessions for this trade.",
        downloadPdf: "Download PDF",
        edit: "Edit",
        generatePdf: "Generate PDF",
        hideLines: "Hide Lines",
        rejected: "Mark Rejected",
        regeneratePdf: "Regenerate PDF",
        revert: "Revert to Draft",
        round: "Round {round}",
        sent: "Mark Sent",
        title: "Client quotation rounds",
        viewLines: "View Lines",
      };
  const router = useRouter();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [editRequestBySession, setEditRequestBySession] = useState<Record<string, number>>({});
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [loadedLines, setLoadedLines] = useState<Record<string, LoadedQuotationLines>>({});
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(sessionId: string, status: ClientQuotationSession["status"]) {
    setPendingSessionId(sessionId);

    startTransition(async () => {
      const result = await updateQuotationSessionStatus(sessionId, status);

      setPendingSessionId(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Quotation status updated");
      router.refresh();
    });
  }

  async function loadLines(sessionId: string) {
    if (loadedLines[sessionId]) {
      return;
    }

    setLoadingSessionId(sessionId);

    try {
      const response = await fetch(`/api/quotation-lines?sessionId=${sessionId}`);
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Unable to load quotation lines");
        return;
      }

      setLoadedLines((currentLines) => ({
        ...currentLines,
        [sessionId]: {
          lines: payload.lines ?? [],
          products: payload.products ?? [],
        },
      }));
    } catch {
      toast.error("Unable to load quotation lines");
    } finally {
      setLoadingSessionId(null);
    }
  }

  async function toggleLines(sessionId: string) {
    const nextExpandedSessionId = expandedSessionId === sessionId ? null : sessionId;
    setExpandedSessionId(nextExpandedSessionId);

    if (!nextExpandedSessionId) {
      return;
    }

    await loadLines(sessionId);
  }

  async function editLines(sessionId: string) {
    setExpandedSessionId(sessionId);
    setEditRequestBySession((currentRequests) => ({
      ...currentRequests,
      [sessionId]: (currentRequests[sessionId] ?? 0) + 1,
    }));
    await loadLines(sessionId);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#0d1b34]">{text.title}</p>
          <p className="text-xs text-slate-500">{text.description}</p>
        </div>

        <div className="flex justify-end">{canManage ? <NewQuotationSessionDialog tradeId={tradeId} /> : null}</div>
      </div>

      {initialSessions.length ? (
        <div className="grid gap-4">
          {initialSessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const isSessionPending = isPending && pendingSessionId === session.id;

            return (
              <Card className="border-slate-200 shadow-sm" key={session.id}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{text.round.replace("{round}", String(session.session_number))}</CardTitle>
                        <span className="text-sm text-slate-500">{formatDate(session.quote_date)}</span>
                        <StatusBadge status={session.status} />
                      </div>
                      {session.client ? (
                        <p className="mt-2 text-sm text-slate-500">
                          {text.client}: {session.client.code}
                        </p>
                      ) : null}
                      {session.notes ? <p className="mt-2 text-sm text-slate-500">{session.notes}</p> : null}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {canManage && session.status === "draft" ? (
                        <Button
                          disabled={isSessionPending}
                          onClick={() => updateStatus(session.id, "sent")}
                          size="sm"
                          variant="outline"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          {text.sent}
                        </Button>
                      ) : null}
                      {canManage && session.status === "sent" ? (
                        <>
                          <Button
                            disabled={isSessionPending}
                            onClick={() => updateStatus(session.id, "accepted")}
                            size="sm"
                            variant="outline"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {text.accepted}
                          </Button>
                          <Button
                            disabled={isSessionPending}
                            onClick={() => updateStatus(session.id, "rejected")}
                            size="sm"
                            variant="outline"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            {text.rejected}
                          </Button>
                        </>
                      ) : null}
                      {canManage && (session.status === "accepted" || session.status === "rejected") ? (
                        <Button
                          disabled={isSessionPending}
                          onClick={() => updateStatus(session.id, "draft")}
                          size="sm"
                          variant="outline"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          {text.revert}
                        </Button>
                      ) : null}
                      {canManage ? (
                        <GenerateQuotationDialog defaultRef={session.quotation_ref ?? undefined} sessionId={session.id}>
                          <Button size="sm" variant="outline">
                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                            {session.pdf_onedrive_url ? text.regeneratePdf : text.generatePdf}
                          </Button>
                        </GenerateQuotationDialog>
                      ) : null}
                      {session.pdf_onedrive_url ? (
                        <a
                          download
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-[#0d1b34] underline-offset-2 hover:bg-slate-50 hover:underline"
                          href={buildDownloadUrl(
                            session.pdf_onedrive_url,
                            `quotation-${session.quotation_ref ?? session.id}.pdf`
                          )}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {text.downloadPdf}
                        </a>
                      ) : null}
                      {canManage && (session.status === "draft" || session.status === "sent") ? (
                        <Button disabled={loadingSessionId === session.id} onClick={() => editLines(session.id)} size="sm">
                          <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                          {text.edit}
                        </Button>
                      ) : null}
                      <Button onClick={() => toggleLines(session.id)} size="sm" variant="outline">
                        {isExpanded ? text.hideLines : text.viewLines}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded ? (
                  <CardContent>
                    {loadingSessionId === session.id ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : (
                      <QuotationLinesEditor
                        availableProducts={loadedLines[session.id]?.products ?? []}
                        canManage={canManage}
                        initialLines={loadedLines[session.id]?.lines ?? []}
                        editRequestKey={editRequestBySession[session.id] ?? 0}
                        sessionId={session.id}
                        sessionStatus={session.status}
                        workingExchangeRate={workingExchangeRate}
                      />
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-10 text-sm text-slate-500">No quotation sessions yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
