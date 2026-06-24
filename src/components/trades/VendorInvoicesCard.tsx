"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateVendorInvoiceStatus } from "@/app/actions/vendor-invoices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { buildDownloadUrl } from "@/lib/download";
import type { ExpenseVendorInvoice, TradeShareholder } from "@/types";
import { GenerateVendorInvoiceDialog } from "./GenerateVendorInvoiceDialog";

const statusLabels = { draft: "Draft", paid: "Paid", sent: "Sent" } as const;
const statusClasses: Record<string, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusClasses[status] ?? statusClasses.draft} variant="outline">
      {statusLabels[status as keyof typeof statusLabels] ?? status}
    </Badge>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value);
}

function VendorInvoiceStatusDropdown({ invoice }: { invoice: ExpenseVendorInvoice }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: ExpenseVendorInvoice["status"]) {
    startTransition(async () => {
      const result = await updateVendorInvoiceStatus(invoice.id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Status updated");
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
        {(["draft", "sent", "paid"] as ExpenseVendorInvoice["status"][]).map((status) => (
          <DropdownMenuItem disabled={status === invoice.status} key={status} onClick={() => setStatus(status)}>
            {statusLabels[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function buildShareholderMap(shareholders: TradeShareholder[]) {
  return new Map(shareholders.map((shareholder) => [shareholder.id, shareholder.person_name]));
}

export function VendorInvoicesCard({
  canManage,
  existingInvoices,
  shareholders,
  tradeId,
}: {
  tradeId: string;
  canManage: boolean;
  shareholders: TradeShareholder[];
  existingInvoices: ExpenseVendorInvoice[];
}) {
  const eligibleShareholders = shareholders.filter(
    (shareholder) =>
      shareholder.invoices_through_entity && Boolean(shareholder.expense_vendor_id) && Boolean(shareholder.expense_vendor)
  );
  const shareholderMap = buildShareholderMap(shareholders);

  if (!eligibleShareholders.length && !existingInvoices.length) {
    return null;
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Vendor Invoices</CardTitle>
        {canManage && eligibleShareholders.length ? (
          <div className="flex flex-wrap gap-2">
            {eligibleShareholders.map((shareholder) => (
              <GenerateVendorInvoiceDialog key={shareholder.id} shareholder={shareholder} tradeId={tradeId} />
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {existingInvoices.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Shareholder</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-xs">{invoice.invoice_number ?? "-"}</TableCell>
                  <TableCell>
                    {invoice.trade_shareholder_id
                      ? (shareholderMap.get(invoice.trade_shareholder_id) ?? "-")
                      : "-"}
                  </TableCell>
                  <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell>{formatUsd(invoice.amount_usd)}</TableCell>
                  <TableCell>
                    {invoice.pdf_onedrive_url ? (
                      <a
                        download
                        className="font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                        href={buildDownloadUrl(invoice.pdf_onedrive_url, `vendor-invoice-${invoice.id}.pdf`)}
                      >
                        Download
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {canManage ? <VendorInvoiceStatusDropdown invoice={invoice} /> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="px-6 py-10 text-sm text-slate-500">No vendor invoices yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
