"use client";

import { ArrowUpDown, Download, Filter, MoreHorizontal, Search, Trash2 } from "lucide-react";
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

type FilterValue = "all";
type SortKey = "date" | "file_name" | "category" | "status" | "type" | "version" | "related_party";
type SortDirection = "asc" | "desc";

const sortValueGetters: Record<SortKey, (document: TradeDocument) => string | number> = {
  category: (document) => document.document_category,
  date: (document) => new Date(document.created_at).getTime(),
  file_name: (document) => document.file_name.toLowerCase(),
  related_party: (document) => document.related_party?.toLowerCase() ?? "",
  status: (document) => document.status,
  type: (document) => document.document_type?.toLowerCase() ?? "",
  version: (document) => document.version,
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

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function optionLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
          deletedToast: "文件已刪除",
          statusToast: "文件狀態已更新",
          updateStatus: "更新狀態",
        }
      : {
          cancel: "Cancel",
          delete: "Delete",
          deleteDescription: "This removes the document record from the trade. This cannot be undone.",
          deleteDocument: "Delete Document",
          deleteTitle: "Delete document?",
          deletedToast: "Document deleted",
          statusToast: "Document status updated",
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

      toast.success(text.statusToast);
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

      toast.success(text.deletedToast);
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
  const statusText = language === "zh" ? zhStatusLabels : statusLabels;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TradeDocument["document_category"] | FilterValue>("all");
  const [statusFilter, setStatusFilter] = useState<TradeDocument["status"] | FilterValue>("all");
  const [typeFilter, setTypeFilter] = useState<string | FilterValue>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const text =
    language === "zh"
      ? {
          actions: "操作",
          allCategories: "所有分類",
          allStatuses: "所有狀態",
          allTypes: "所有類型",
          ascending: "升冪",
          category: "分類",
          date: "日期",
          descending: "降冪",
          download: "下載",
          fileLibrary: "文件庫",
          fileName: "檔案名稱",
          filters: "篩選",
          matches: "筆文件",
          noDocuments: "尚無文件。請上傳第一個文件。",
          noMatches: "沒有符合搜尋或篩選的文件。",
          relatedParty: "相關對象",
          search: "搜尋檔名、分類、狀態、備註...",
          sortBy: "排序",
          status: "狀態",
          type: "類型",
          version: "版本",
        }
      : {
          actions: "Actions",
          allCategories: "All Categories",
          allStatuses: "All Statuses",
          allTypes: "All Types",
          ascending: "Ascending",
          category: "Category",
          date: "Date",
          descending: "Descending",
          download: "Download",
          fileLibrary: "File Library",
          fileName: "File Name",
          filters: "Filters",
          matches: "files",
          noDocuments: "No documents yet. Upload the first document.",
          noMatches: "No documents match this search or filter.",
          relatedParty: "Related Party",
          search: "Search file name, category, status, notes...",
          sortBy: "Sort By",
          status: "Status",
          type: "Type",
          version: "Version",
        };
  const documentTypes = useMemo(
    () =>
      Array.from(new Set(initialDocuments.map((document) => document.document_type).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b)
      ),
    [initialDocuments]
  );

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return initialDocuments.filter((document) => {
      if (categoryFilter !== "all" && document.document_category !== categoryFilter) return false;
      if (statusFilter !== "all" && document.status !== statusFilter) return false;
      if (typeFilter !== "all" && document.document_type !== typeFilter) return false;

      if (!normalizedSearch) return true;

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
        `v${document.version}`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [categoryFilter, initialDocuments, labels, search, statusFilter, typeFilter]);

  const sortedDocuments = useMemo(() => {
    return [...filteredDocuments].sort((a, b) => {
      const aValue = sortValueGetters[sortKey](a);
      const bValue = sortValueGetters[sortKey](b);
      const direction = sortDirection === "asc" ? 1 : -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * direction;
      }

      return String(aValue).localeCompare(String(bValue)) * direction;
    });
  }, [filteredDocuments, sortDirection, sortKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#0d1b34]">{text.fileLibrary}</h3>
          <p className="text-sm text-slate-500">
            {sortedDocuments.length} / {initialDocuments.length} {text.matches}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative lg:w-[360px]">
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
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
            <span className="inline-flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              {text.filters}
            </span>
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-[#0d1b34] shadow-sm"
              onChange={(event) => setCategoryFilter(event.target.value as TradeDocument["document_category"] | FilterValue)}
              value={categoryFilter}
            >
              <option value="all">{text.allCategories}</option>
              {(Object.keys(categoryLabels) as TradeDocument["document_category"][]).map((category) => (
                <option key={category} value={category}>
                  {labels[category]}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-[#0d1b34] shadow-sm"
              onChange={(event) => setStatusFilter(event.target.value as TradeDocument["status"] | FilterValue)}
              value={statusFilter}
            >
              <option value="all">{text.allStatuses}</option>
              {(Object.keys(statusLabels) as TradeDocument["status"][]).map((status) => (
                <option key={status} value={status}>
                  {statusText[status]}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-[#0d1b34] shadow-sm"
              onChange={(event) => setTypeFilter(event.target.value)}
              value={typeFilter}
            >
              <option value="all">{text.allTypes}</option>
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {optionLabel(type)}
                </option>
              ))}
            </select>
            <span className="inline-flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {text.sortBy}
            </span>
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-[#0d1b34] shadow-sm"
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              value={sortKey}
            >
              <option value="date">{text.date}</option>
              <option value="file_name">{text.fileName}</option>
              <option value="category">{text.category}</option>
              <option value="status">{text.status}</option>
              <option value="type">{text.type}</option>
              <option value="version">{text.version}</option>
              <option value="related_party">{text.relatedParty}</option>
            </select>
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-[#0d1b34] shadow-sm"
              onChange={(event) => setSortDirection(event.target.value as SortDirection)}
              value={sortDirection}
            >
              <option value="desc">{text.descending}</option>
              <option value="asc">{text.ascending}</option>
            </select>
          </div>
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
                {sortedDocuments.length ? (
                  sortedDocuments.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="min-w-[260px]">
                        <span className="font-medium text-[#0d1b34]">{document.file_name}</span>
                        {document.notes ? <p className="mt-1 text-xs text-slate-500">{document.notes}</p> : null}
                      </TableCell>
                      <TableCell>{labels[document.document_category]}</TableCell>
                      <TableCell>{document.document_type ? optionLabel(document.document_type) : "-"}</TableCell>
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
