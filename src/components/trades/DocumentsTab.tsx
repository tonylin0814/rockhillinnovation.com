"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";

import { updateDocumentStatus } from "@/app/actions/documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: TradeDocument["status"] }) {
  return (
    <Badge className={statusClasses[status]} variant="outline">
      {statusLabels[status]}
    </Badge>
  );
}

function DocumentStatusDropdown({ document }: { document: TradeDocument }) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={isPending} size="icon" type="button" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Update status</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(statusLabels) as TradeDocument["status"][]).map((status) => (
          <DropdownMenuItem disabled={status === document.status} key={status} onClick={() => setStatus(status)}>
            {statusLabels[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
                {categoryLabels[group.category]}
              </h3>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Related Party</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.documents.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell>
                            {document.onedrive_url ? (
                              <a
                                className="font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                                href={document.onedrive_url}
                                rel="noreferrer"
                                target="_blank"
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
            No documents yet. Upload the first document.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
