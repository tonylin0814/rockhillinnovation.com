"use client";

import { BarChart2, CheckCircle2, ChevronsUpDown, FileText, PencilLine, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteQuoteSession, updateQuoteSessionStatus } from "@/app/actions/supplier-quotes";
import { useLanguage } from "@/context/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { SupplierQuoteLine, SupplierQuoteSession } from "@/types";
import { NewQuoteSessionDialog } from "./NewQuoteSessionDialog";
import { PriceHistoryDialog } from "./PriceHistoryDialog";
import { QuoteLinesEditor } from "./QuoteLinesEditor";
import { QuoteReviewDialog } from "./QuoteReviewDialog";

type ProductOption = {
  id: string;
  code: string;
  supplier_product_code: string | null;
  name_english: string;
  product_type: "part" | "set";
  latest_cost_rmb?: number | null;
  previous_cost_rmb?: number | null;
  previous_quote_date?: string | null;
  previous_quote_trade_id?: string | null;
  previous_quote_usd?: number | null;
};

type LoadedQuoteLines = {
  lines: SupplierQuoteLine[];
  products: ProductOption[];
};

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

function productLabel(product: ProductOption) {
  return [product.code, product.supplier_product_code, product.name_english].filter(Boolean).join(" - ");
}

function compareProductsByName(a: ProductOption, b: ProductOption) {
  return (
    a.name_english.localeCompare(b.name_english, undefined, { sensitivity: "base", numeric: true }) ||
    a.code.localeCompare(b.code, undefined, { sensitivity: "base", numeric: true })
  );
}

export function SupplierQuotesTab({
  availableProducts,
  canManage,
  initialSessions,
  tradeId,
}: {
  tradeId: string;
  initialSessions: SupplierQuoteSession[];
  availableProducts: ProductOption[];
  canManage: boolean;
}) {
  const { language } = useLanguage();
  const text = language === "zh"
    ? {
        confirm: "確認",
        delete: "刪除",
        deleteDescription: "這會刪除此輪供應商報價與所有明細。剩餘輪次會自動重新編號。",
        deleteRound: "刪除第 {round} 輪？",
        edit: "編輯",
        hideLines: "隱藏明細",
        lookup: "查詢任何產品的價格歷史",
        noProducts: "找不到產品。",
        noSessions: "尚無供應商報價輪次。",
        noSource: "尚未附來源文件",
        round: "第 {round} 輪",
        search: "搜尋產品代碼或名稱",
        searchProducts: "搜尋產品...",
        source: "來源文件",
        supersede: "取代",
        viewLines: "查看明細",
      }
    : {
        confirm: "Confirm",
        delete: "Delete",
        deleteDescription: "This deletes the quote round and its lines. Remaining rounds will be renumbered automatically.",
        deleteRound: "Delete Round {round}?",
        edit: "Edit",
        hideLines: "Hide Lines",
        lookup: "Look up price history for any product",
        noProducts: "No products found.",
        noSessions: "No quote sessions yet.",
        noSource: "No source document attached",
        round: "Round {round}",
        search: "Search product code or name",
        searchProducts: "Search products...",
        source: "Source document",
        supersede: "Supersede",
        viewLines: "View Lines",
      };
  const router = useRouter();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [editRequestBySession, setEditRequestBySession] = useState<Record<string, number>>({});
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [loadedLines, setLoadedLines] = useState<Record<string, LoadedQuoteLines>>({});
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [priceLookupOpen, setPriceLookupOpen] = useState(false);
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<ProductOption | null>(null);
  const [isPending, startTransition] = useTransition();
  const sortedProducts = useMemo(() => [...availableProducts].sort(compareProductsByName), [availableProducts]);

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

  function deleteSession(sessionId: string) {
    setPendingSessionId(sessionId);

    startTransition(async () => {
      const result = await deleteQuoteSession(sessionId);

      setPendingSessionId(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setExpandedSessionId((currentSessionId) => (currentSessionId === sessionId ? null : currentSessionId));
      setLoadedLines((currentLines) => {
        const nextLines = { ...currentLines };
        delete nextLines[sessionId];
        return nextLines;
      });
      window.localStorage.removeItem(`rockhill:supplier-quote-lines:${sessionId}`);
      toast.success("Quote round deleted");
      router.refresh();
    });
  }

  async function loadLines(sessionId: string) {
    if (loadedLines[sessionId]) {
      return;
    }

    setLoadingSessionId(sessionId);

    try {
      const response = await fetch(`/api/quote-lines?sessionId=${sessionId}`);
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Unable to load quote lines");
        return;
      }

      setLoadedLines((currentLines) => ({
        ...currentLines,
        [sessionId]: {
          lines: payload.lines ?? [],
          products: payload.products ?? availableProducts,
        },
      }));
    } catch {
      toast.error("Unable to load quote lines");
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
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#0d1b34]">{text.lookup}</p>
          <Popover open={priceLookupOpen} onOpenChange={setPriceLookupOpen}>
            <PopoverTrigger asChild>
              <Button className="w-full justify-between lg:w-96" role="combobox" type="button" variant="outline">
                <span className="flex min-w-0 items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-slate-500" />
                  <span className="truncate">{text.search}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 text-slate-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
              <Command>
                <CommandInput placeholder={text.searchProducts} />
                <CommandList>
                  <CommandEmpty>{text.noProducts}</CommandEmpty>
                  <CommandGroup>
                    {sortedProducts.map((product) => (
                      <CommandItem
                        key={product.id}
                        onSelect={() => {
                          setSelectedHistoryProduct(product);
                          setPriceLookupOpen(false);
                        }}
                        value={`${product.code} ${product.supplier_product_code ?? ""} ${product.name_english}`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-[#0d1b34]">{product.code}</div>
                          <div className="truncate text-xs text-slate-500">{productLabel(product)}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex justify-end">{canManage ? <NewQuoteSessionDialog tradeId={tradeId} /> : null}</div>
      </div>

      {selectedHistoryProduct ? (
        <PriceHistoryDialog
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setSelectedHistoryProduct(null);
            }
          }}
          open={Boolean(selectedHistoryProduct)}
          productCode={selectedHistoryProduct.code}
          productId={selectedHistoryProduct.id}
          productName={selectedHistoryProduct.name_english}
          trigger={null}
        />
      ) : null}

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
                        <RecordedByBadge recordedBy={session.recorded_by} />
                      </div>
                      <div className="mt-2">
                        {session.source_document_url ? (
                          <a
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                            href={session.source_document_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <FileText className="h-3 w-3" />
                            {text.source}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">{text.noSource}</span>
                        )}
                      </div>
                      {session.notes ? <p className="mt-2 text-sm text-slate-500">{session.notes}</p> : null}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {canManage ? <QuoteReviewDialog sessionId={session.id} /> : null}
                      {canManage && session.status === "draft" ? (
                        <Button
                          disabled={isSessionPending}
                          onClick={() => updateStatus(session.id, "confirmed")}
                          size="sm"
                          variant="outline"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {text.confirm}
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
                          {text.supersede}
                        </Button>
                      ) : null}
                      {canManage && session.status === "draft" ? (
                        <Button disabled={loadingSessionId === session.id} onClick={() => editLines(session.id)} size="sm">
                          <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                          {text.edit}
                        </Button>
                      ) : null}
                      <Button
                        onClick={() => toggleLines(session.id)}
                        size="sm"
                        variant="outline"
                      >
                        {isExpanded ? text.hideLines : text.viewLines}
                      </Button>
                      {canManage ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button disabled={isSessionPending} size="sm" variant="outline">
                              <Trash2 className="mr-2 h-4 w-4" />
                              {text.delete}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{text.deleteRound.replace("{round}", String(session.session_number))}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {text.deleteDescription}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isSessionPending}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                disabled={isSessionPending}
                                onClick={() => deleteSession(session.id)}
                              >
                                {text.delete}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
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
                      <QuoteLinesEditor
                        availableProducts={loadedLines[session.id]?.products ?? availableProducts}
                        canManage={canManage}
                        editRequestKey={editRequestBySession[session.id] ?? 0}
                        initialLines={loadedLines[session.id]?.lines ?? []}
                        sessionId={session.id}
                        sessionStatus={session.status}
                        tradeId={tradeId}
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
          <CardContent className="py-10 text-sm text-slate-500">{text.noSessions}</CardContent>
        </Card>
      )}
    </div>
  );
}
