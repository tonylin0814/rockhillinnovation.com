"use client";

import { ChevronDown, FileText, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateInvoiceStatus } from "@/app/actions/invoices";
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
import type { ClientInvoice } from "@/types";
import { GenerateInvoiceDialog } from "./GenerateProFormaDialog";

const typeLabels: Record<ClientInvoice["invoice_type"], string> = {
  deposit: "Deposit",
  final: "Final",
  pro_forma: "Pro-Forma",
};

const typeClasses: Record<ClientInvoice["invoice_type"], string> = {
  deposit: "border-blue-200 bg-blue-50 text-blue-700",
  final: "border-green-200 bg-green-50 text-green-700",
  pro_forma: "border-slate-200 bg-slate-100 text-slate-700",
};

const statusLabels: Record<ClientInvoice["status"], string> = {
  draft: "Draft",
  paid: "Paid",
  sent: "Sent",
};

const statusClasses: Record<ClientInvoice["status"], string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function TypeBadge({ type }: { type: ClientInvoice["invoice_type"] }) {
  return (
    <Badge className={typeClasses[type]} variant="outline">
      {typeLabels[type]}
    </Badge>
  );
}

function StatusBadge({ status }: { status: ClientInvoice["status"] }) {
  return (
    <Badge className={statusClasses[status]} variant="outline">
      {statusLabels[status]}
    </Badge>
  );
}

function InvoiceStatusDropdown({ invoice }: { invoice: ClientInvoice }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: ClientInvoice["status"]) {
    startTransition(async () => {
      const result = await updateInvoiceStatus(invoice.id, status);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Invoice status updated");
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
        {(Object.keys(statusLabels) as ClientInvoice["status"][]).map((status) => (
          <DropdownMenuItem disabled={status === invoice.status} key={status} onClick={() => setStatus(status)}>
            {statusLabels[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GenerateInvoiceMenu({ tradeId }: { tradeId: string }) {
  return (
    <div className="flex justify-end">
      <GenerateInvoiceDialog tradeId={tradeId} type="pro_forma">
        <Button className="rounded-r-none bg-[#0d1b34] hover:bg-[#13294d]">
          <FileText className="mr-2 h-4 w-4" />
          Generate Invoice
        </Button>
      </GenerateInvoiceDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Choose invoice type"
            className="rounded-l-none border-l border-white/20 bg-[#0d1b34] px-3 hover:bg-[#13294d]"
            type="button"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <GenerateInvoiceDialog tradeId={tradeId} type="pro_forma">
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Pro-Forma Invoice</DropdownMenuItem>
          </GenerateInvoiceDialog>
          <GenerateInvoiceDialog tradeId={tradeId} type="deposit">
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Deposit Invoice</DropdownMenuItem>
          </GenerateInvoiceDialog>
          <GenerateInvoiceDialog tradeId={tradeId} type="final">
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Final Invoice</DropdownMenuItem>
          </GenerateInvoiceDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function InvoicesTab({
  canManage,
  initialInvoices,
  tradeId,
}: {
  tradeId: string;
  initialInvoices: ClientInvoice[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {canManage ? <GenerateInvoiceMenu tradeId={tradeId} /> : null}

      {initialInvoices.length ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>PDF</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      <TypeBadge type={invoice.invoice_type} />
                    </TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell>{formatUsd(invoice.total_usd)}</TableCell>
                    <TableCell>
                      {invoice.pdf_onedrive_url ? (
                        <a
                          className="font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                          href={invoice.pdf_onedrive_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Download
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {canManage ? <InvoiceStatusDropdown invoice={invoice} /> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-10 text-sm text-slate-500">No invoices yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
