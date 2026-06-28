"use client";

import { Download, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteDocument, updateDocumentStatus } from "@/app/actions/documents";
import { UploadDocumentDialog } from "@/components/trades/UploadDocumentDialog";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/context/LanguageContext";
import { buildDownloadUrl } from "@/lib/download";
import type { TradeDocument } from "@/types";

const categoryLabels: Record<TradeDocument["document_category"], string> = {
  approval: "Approvals",
  client_quotation: "Client Quotations",
  design: "Design",
  invoice: "Invoices",
  other: "Other",
  shipping: "Shipping",
  supplier_quote: "Supplier Quotes",
};

const zhCategoryLabels: Record<TradeDocument["document_category"], string> = {
  approval: "核准文件",
  client_quotation: "客戶報價",
  design: "設計",
  invoice: "發票",
  other: "其他",
  shipping: "出貨",
  supplier_quote: "供應商報價",
};

const statusLabels: Record<TradeDocument["status"], string> = {
  approved: "Approved",
  archived: "Archived",
  draft: "Draft",
  sent: "Sent",
  sent_to_printer: "Sent to Printer",
};

const zhStatusLabels: Record<TradeDocument["status"], string> = {
  approved: "已核准",
  archived: "已封存",
  draft: "草稿",
  sent: "已寄出",
  sent_to_printer: "已送印",
};

const statusClasses: Record<TradeDocument["status"], string> = {
  approved: "border-green-200 bg-green-50 text-green-700",
  archived: "border-red-200 bg-red-50 text-red-700",
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
  sent_to_printer: "border-violet-200 bg-violet-50 text-violet-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: TradeDocument["status"] }) {
  const { language } = useLanguage();
  const labels = language === "zh" ? zhStatusLabels : statusLabels;

  return (
    <Badge className={statusClasses[status]} variant="outline">
      {labels[status]}
    </Badge>
  );
}

function DocumentStatusDropdown({ document }: { document: TradeDocument }) {
  const { language } = useLanguage();
  const labels = language === "zh" ? zhStatusLabels : statusLabels;
  const text =
    language === "zh"
      ? {
          cancel: "取消",
          delete: "刪除",
          deleteDescription: "這會從交易中移除此文件紀錄。此動作無法復原。",
          deleteDocument: "刪除文件",
          deleteTitle: "刪除文件？",
          updateStatus: "更新狀態",
        }
      : {
          cancel: "Cancel",
          delete: "Delete",
          deleteDescription: "This removes the document record from the trade. This cannot be undone.",
          deleteDocument: "Delete Document",
          deleteTitle: "Delete document?",
          updateStatus: "Update status",
        };
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: TradeDocument["status"]) {
    startTransition(async () => {
      const result = await updateDocumentStatus(document.id, status);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Document status updated");
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDocument(document.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Document deleted");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={isPending} size="icon" type="button" variant="ghost">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">{text.updateStatus}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(statusLabels) as TradeDocument["status"][]).map((status) => (
            <DropdownMenuItem disabled={status === document.status} key={status} onClick={() => setStatus(status)}>
              {labels[status]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={(event) => event.preventDefault()}>
              <Trash2 className="mr-2 h-4 w-4" />
              {text.delete}
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{text.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>{text.deleteDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{text.cancel}</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleDelete}>
            {text.deleteDocument}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DocumentsTab({
  initialDocuments,
  tradeCode,
  tradeId,
}: {
  tradeId: string;
  tradeCode: string;
  initialDocuments: TradeDocument[];
}) {
  const { language } = useLanguage();
  const labels = language === "zh" ? zhCategoryLabels : categoryLabels;
  const [search, setSearch] = useState("");
  const text =
    language === "zh"
      ? {
          actions: "操作",
          category: "分類",
          date: "日期",
          download: "下載",
          fileLibrary: "文件庫",
          fileName: "檔案名稱",
          matches: "筆文件",
          noDocuments: "尚無文件。請上傳第一個文件。",
          noMatches: "沒有符合搜尋的文件。",
          relatedParty: "相關對象",
          search: "搜尋檔名、分類、狀態、備註...",
          status: "狀態",
          type: "類型",
          version: "版本",
        }
      : {
          actions: "Actions",
          category: "Category",
          date: "Date",
          download: "Download",
          fileLibrary: "File Library",
          fileName: "File Name",
          matches: "files",
          noDocuments: "No documents yet. Upload the first document.",
          noMatches: "No documents match this search.",
          relatedParty: "Related Party",
          search: "Search file name, category, status, notes...",
          status: "Status",
          type: "Type",
          version: "Version",
        };
  const sortedDocuments = useMemo(
    () =>
      [...initialDocuments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [initialDocuments]
  );
  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return sortedDocuments;
    }

    return sortedDocuments.filter((document) => {
      const haystack = [
        document.file_name,
        document.document_type,
        labels[document.document_category],
        document.document_category,
        document.related_party,
        statusLabels[document.status],
        zhStatusLabels[document.status],
        document.notes,
        formatDate(document.created_at),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [labels, search, sortedDocuments]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#0d1b34]">{text.fileLibrary}</h3>
          <p className="text-sm text-slate-500">
            {filteredDocuments.length} / {initialDocuments.length} {text.matches}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={text.search}
              value={search}
            />
          </div>
          <UploadDocumentDialog tradeCode={tradeCode} tradeId={tradeId} />
        </div>
      </div>

      {initialDocuments.length ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.fileName}</TableHead>
                  <TableHead>{text.category}</TableHead>
                  <TableHead>{text.type}</TableHead>
                  <TableHead>{text.version}</TableHead>
                  <TableHead>{text.status}</TableHead>
                  <TableHead>{text.relatedParty}</TableHead>
                  <TableHead>{text.date}</TableHead>
                  <TableHead>{text.download}</TableHead>
                  <TableHead className="text-right">{text.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length ? (
                  filteredDocuments.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="min-w-[260px]">
                        <span className="font-medium text-[#0d1b34]">{document.file_name}</span>
                        {document.notes ? <p className="mt-1 text-xs text-slate-500">{document.notes}</p> : null}
                      </TableCell>
                      <TableCell>{labels[document.document_category]}</TableCell>
                      <TableCell className="capitalize">{document.document_type ?? "-"}</TableCell>
                      <TableCell>v{document.version}</TableCell>
                      <TableCell>
                        <StatusBadge status={document.status} />
                      </TableCell>
                      <TableCell className="capitalize">{document.related_party ?? "-"}</TableCell>
                      <TableCell>{formatDate(document.created_at)}</TableCell>
                      <TableCell>
                        {document.onedrive_url ? (
                          <Button asChild size="sm" type="button" variant="outline">
                            <a download href={buildDownloadUrl(document.onedrive_url, document.file_name ?? "document")}>
                              <Download className="mr-2 h-4 w-4" />
                              {text.download}
                            </a>
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <DocumentStatusDropdown document={document} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="py-8 text-center text-sm text-slate-500" colSpan={9}>
                      {text.noMatches}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-10 text-sm text-slate-500">{text.noDocuments}</CardContent>
        </Card>
      )}
    </div>
  );
}
