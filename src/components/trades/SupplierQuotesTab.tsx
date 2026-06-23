"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateQuoteSessionStatus } from "@/app/actions/supplier-quotes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupplierQuoteSession } from "@/types";
import { NewQuoteSessionDialog } from "./NewQuoteSessionDialog";

const statusClasses: Record<SupplierQuoteSession["status"], string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  confirmed: "border-green-200 bg-green-50 text-green-700",
  superseded: "border-red-200 bg-red-50 text-red-700",
};

const recordedByClasses: Record<SupplierQuoteSession["recorded_by"], string> = {
  chatgpt: "border-violet-200 bg-violet-50 text-violet-700",
  judy: "border-blue-200 bg-blue-50 text-blue-700",
  manual: "border-slate-200 bg-slate-100 text-slate-700",
};

const recordedByLabels: Record<SupplierQuoteSession["recorded_by"], string> = {
  chatgpt: "ChatGPT",
  judy: "Judy",
  manual: "Manual",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: SupplierQuoteSession["status"] }) {
  return (
    <Badge className={statusClasses[status]} variant="outline">
      {status}
    </Badge>
  );
}

function RecordedByBadge({ recordedBy }: { recordedBy: SupplierQuoteSession["recorded_by"] }) {
  return (
    <Badge className={recordedByClasses[recordedBy]} variant="outline">
      {recordedByLabels[recordedBy]}
    </Badge>
  );
}

export function SupplierQuotesTab({
  canManage,
  initialSessions,
  tradeId,
}: {
  tradeId: string;
  initialSessions: SupplierQuoteSession[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(sessionId: string, status: SupplierQuoteSession["status"]) {
    setPendingSessionId(sessionId);

    startTransition(async () => {
      const result = await updateQuoteSessionStatus(sessionId, status);

      setPendingSessionId(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(status === "confirmed" ? "Quote session confirmed" : "Quote session superseded");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{canManage ? <NewQuoteSessionDialog tradeId={tradeId} /> : null}</div>

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
                        <CardTitle>Round {session.session_number}</CardTitle>
                        <span className="text-sm text-slate-500">{formatDate(session.quote_date)}</span>
                        <StatusBadge status={session.status} />
                        <RecordedByBadge recordedBy={session.recorded_by} />
                      </div>
                      {session.notes ? <p className="mt-2 text-sm text-slate-500">{session.notes}</p> : null}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {canManage && session.status === "draft" ? (
                        <Button
                          disabled={isSessionPending}
                          onClick={() => updateStatus(session.id, "confirmed")}
                          size="sm"
                          variant="outline"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Confirm
                        </Button>
                      ) : null}
                      {canManage && session.status === "confirmed" ? (
                        <Button
                          disabled={isSessionPending}
                          onClick={() => updateStatus(session.id, "superseded")}
                          size="sm"
                          variant="outline"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Supersede
                        </Button>
                      ) : null}
                      <Button
                        onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                        size="sm"
                        variant="outline"
                      >
                        View Lines
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded ? <CardContent className="text-sm text-slate-500">No lines yet.</CardContent> : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-10 text-sm text-slate-500">No quote sessions yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
