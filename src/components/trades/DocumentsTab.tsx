"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";

import { deleteDocument, updateDocumentStatus } from "@/app/actions/documents";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildDownloadUrl } from "@/lib/download";
import type { TradeDocument } from "@/types";
import { UploadDocumentDialog } from "./UploadDocumentDialog";

const categoryOrder: TradeDocument["document_category"][] = [
  "design",
  "supplier_quote",
  "client_quotation",
  "invoice",
  "shipping",
  "approval",
  "other",
];

const categoryLabels: Record<TradeDocument["document_category"], string> = {
  design: "Design",
  supplier_quote: "Supplier Quotes",
  client_quotation: "Client Quotations",
  invoice: "Invoices",
  shipping: "Shipping",
  approval: "Approvals",
  other: "Other",
};

const statusLabels: Record<TradeDocument["status"], string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  sent_to_printer: "Sent to Printer",
  archived: "Archived",
};

const statusClasses: Record<TradeDocument["status"], string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
  approved: "border-green-200 bg-green-50 text-green-700",
  sent_to_printer: "border-violet-200 bg-violet-50 text-violet-700",
  archived: "border-red-200 bg-red-50 text-red-700",
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

const zhStatusLabels: Record<TradeDocument["status"], string> = {
  approved: "已核准",
  archived: "已封存",
  draft: "草稿",
  sent: "已寄出",
  sent_to_printer: "已送印",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
  const text = language === "zh"
    ? {
        delete: "刪除",
        deleteDocument: "刪除文件",
        deleteDescription: "這會從交易中移除此文件紀錄。此動作無法復原。",
        deleteTitle: "刪除文件？",
        updateStatus: "更新狀態",
        cancel: "取消",
      }
    : {
        delete: "Delete",
        deleteDocument: "Delete Document",
        deleteDescription: "This removes the document record from the trade. This cannot be undone.",
        deleteTitle: "Delete document?",
        updateStatus: "Update status",
        cancel: "Cancel",
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{text.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {text.deleteDescription}
          </AlertDialogDescription>
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
  const text = language === "zh"
    ? {
        actions: "操作",
        date: "日期",
        fileName: "檔案名稱",
        noDocuments: "尚無文件。請上傳第一個文件。",
        relatedParty: "相關對象",
        status: "狀態",
        version: "版本",
      }
    : {
        actions: "Actions",
        date: "Date",
        fileName: "File Name",
        noDocuments: "No documents yet. Upload the first document.",
        relatedParty: "Related Party",
        status: "Status",
        version: "Version",
      };
  const groupedDocuments = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          documents: initialDocuments.filter((document) => document.document_category === category),
        }))
        .filter((group) => group.documents.length),
    [initialDocuments]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <UploadDocumentDialog tradeCode={tradeCode} tradeId={tradeId} />
      </div>

      {groupedDocuments.length ? (
        <div className="space-y-6">
          {groupedDocuments.map((group) => (
            <div className="space-y-2" key={group.category}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {labels[group.category]}
              </h3>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{text.fileName}</TableHead>
                        <TableHead>{text.version}</TableHead>
                        <TableHead>{text.status}</TableHead>
                        <TableHead>{text.relatedParty}</TableHead>
                        <TableHead>{text.date}</TableHead>
                        <TableHead className="text-right">{text.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.documents.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell>
                            {document.onedrive_url ? (
                              <a
                                download
                                className="font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                                href={buildDownloadUrl(document.onedrive_url, document.file_name ?? "document")}
                              >
                                {document.file_name}
                              </a>
                            ) : (
                              <span className="font-medium text-[#0d1b34]">{document.file_name}</span>
                            )}
                            {document.document_type ? (
                              <p className="mt-1 text-xs text-slate-500">{document.document_type}</p>
                            ) : null}
                          </TableCell>
                          <TableCell>v{document.version}</TableCell>
                          <TableCell>
                            <StatusBadge status={document.status} />
                          </TableCell>
                          <TableCell className="capitalize">{document.related_party ?? "-"}</TableCell>
                          <TableCell>{formatDate(document.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <DocumentStatusDropdown document={document} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-10 text-sm text-slate-500">
            {text.noDocuments}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
