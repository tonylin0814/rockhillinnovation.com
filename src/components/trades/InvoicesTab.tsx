"use client";

import { ChevronDown, FileText, Mail, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useTransition } from "react";
import { toast } from "sonner";

import { deleteClientInvoice, updateInvoiceStatus } from "@/app/actions/invoices";
import { sendClientInvoice } from "@/app/actions/send-invoice";
import { deleteSupplierInvoice, updateSupplierInvoiceStatus } from "@/app/actions/supplier-invoices-outgoing";
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
import type { ClientInvoice, SupplierInvoiceOutgoing } from "@/types";
import { GenerateInvoiceDialog } from "./GenerateProFormaDialog";
import { GenerateSupplierInvoiceDialog } from "./GenerateSupplierInvoiceDialog";
import { SupplierInvoiceMatchDialog } from "./SupplierInvoiceMatchDialog";

const statusLabels = { draft: "Draft", paid: "Paid", sent: "Sent" } as const;
type SupplierOption = { code: string; id: string; name: string };
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
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatRmb(value: number) {
  return `\u00A5${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

const clientTypeLabels: Record<ClientInvoice["invoice_type"], string> = {
  commercial: "Commercial Invoice",
  deposit: "Deposit Invoice",
  final: "Final Invoice",
  pro_forma: "Pro-Forma Invoice",
};

const clientTypeClasses: Record<ClientInvoice["invoice_type"], string> = {
  commercial: "border-[#0d1b34] bg-[#0d1b34]/10 text-[#0d1b34]",
  deposit: "border-blue-200 bg-blue-50 text-blue-700",
  final: "border-green-200 bg-green-50 text-green-700",
  pro_forma: "border-slate-200 bg-slate-100 text-slate-700",
};

function ClientTypeBadge({ type }: { type: ClientInvoice["invoice_type"] }) {
  return (
    <Badge className={clientTypeClasses[type]} variant="outline">
      {clientTypeLabels[type]}
    </Badge>
  );
}

function ClientInvoiceStatusDropdown({ invoice }: { invoice: ClientInvoice }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: ClientInvoice["status"]) {
    startTransition(async () => {
      const result = await updateInvoiceStatus(invoice.id, status);
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
        {(["draft", "sent", "paid"] as ClientInvoice["status"][]).map((status) => (
          <DropdownMenuItem disabled={status === invoice.status} key={status} onClick={() => setStatus(status)}>
            {statusLabels[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SendInvoiceButton({ invoice }: { invoice: ClientInvoice }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!invoice.pdf_onedrive_url || invoice.status === "paid") {
    return null;
  }

  function handleSend() {
    startTransition(async () => {
      const result = await sendClientInvoice(invoice.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Invoice emailed to client");
      router.refresh();
    });
  }

  return (
    <Button
      disabled={isPending}
      onClick={handleSend}
      size="icon"
      title="Send invoice via email"
      type="button"
      variant="ghost"
    >
      <Mail className="h-4 w-4" />
      <span className="sr-only">Send via email</span>
    </Button>
  );
}

function DeleteClientInvoiceButton({ invoice }: { invoice: ClientInvoice }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClientInvoice(invoice.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Invoice deleted");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} size="icon" title="Delete invoice" type="button" variant="ghost">
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="sr-only">Delete invoice</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete invoice {invoice.invoice_number}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the invoice record and its line items from the system. The generated PDF file in OneDrive is not
            deleted automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleDelete}>
            Delete Invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function GenerateClientInvoiceMenu({ orderNumber, tradeId }: { orderNumber?: string | null; tradeId: string }) {
  return (
    <div className="flex justify-end">
      <GenerateInvoiceDialog orderNumber={orderNumber} tradeId={tradeId}>
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
          <FileText className="mr-2 h-4 w-4" />
          Generate Invoice
        </Button>
      </GenerateInvoiceDialog>
    </div>
  );
}

const supplierTypeClasses: Record<SupplierInvoiceOutgoing["invoice_type"], string> = {
  deposit: "border-blue-200 bg-blue-50 text-blue-700",
  final: "border-green-200 bg-green-50 text-green-700",
};

function SupplierTypeBadge({ type }: { type: SupplierInvoiceOutgoing["invoice_type"] }) {
  return (
    <Badge className={supplierTypeClasses[type]} variant="outline">
      {type === "deposit" ? "Deposit" : "Final"}
    </Badge>
  );
}

function SupplierInvoiceStatusDropdown({ invoice }: { invoice: SupplierInvoiceOutgoing }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: SupplierInvoiceOutgoing["status"]) {
    startTransition(async () => {
      const result = await updateSupplierInvoiceStatus(invoice.id, status);
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
        {(["draft", "sent", "paid"] as SupplierInvoiceOutgoing["status"][]).map((status) => (
          <DropdownMenuItem disabled={status === invoice.status} key={status} onClick={() => setStatus(status)}>
            {statusLabels[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteSupplierInvoiceButton({ invoice }: { invoice: SupplierInvoiceOutgoing }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSupplierInvoice(invoice.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Supplier invoice deleted");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} size="icon" title="Delete supplier invoice" type="button" variant="ghost">
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="sr-only">Delete supplier invoice</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete supplier invoice {invoice.invoice_number}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the supplier invoice record and its line items from the system. The generated PDF file in
            OneDrive is not deleted automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleDelete}>
            Delete Invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function GenerateSupplierInvoiceMenu({
  orderNumber,
  suppliers,
  tradeId,
}: {
  orderNumber?: string | null;
  suppliers: SupplierOption[];
  tradeId: string;
}) {
  return (
    <div className="flex justify-end">
      <GenerateSupplierInvoiceDialog orderNumber={orderNumber} suppliers={suppliers} tradeId={tradeId} type="deposit">
        <Button className="rounded-r-none bg-[#0d1b34] hover:bg-[#13294d]">
          <FileText className="mr-2 h-4 w-4" />
          Generate Supplier Invoice
        </Button>
      </GenerateSupplierInvoiceDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Choose supplier invoice type"
            className="rounded-l-none border-l border-white/20 bg-[#0d1b34] px-3 hover:bg-[#13294d]"
            type="button"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <GenerateSupplierInvoiceDialog orderNumber={orderNumber} suppliers={suppliers} tradeId={tradeId} type="deposit">
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Deposit Invoice</DropdownMenuItem>
          </GenerateSupplierInvoiceDialog>
          <GenerateSupplierInvoiceDialog orderNumber={orderNumber} suppliers={suppliers} tradeId={tradeId} type="final">
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Final Invoice</DropdownMenuItem>
          </GenerateSupplierInvoiceDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function InvoicesTab({
  canManage,
  initialInvoices,
  initialSupplierInvoices,
  orderNumber,
  suppliers,
  tradeId,
}: {
  tradeId: string;
  canManage: boolean;
  initialInvoices: ClientInvoice[];
  initialSupplierInvoices: SupplierInvoiceOutgoing[];
  orderNumber?: string | null;
  suppliers: SupplierOption[];
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0d1b34]">Client Invoices</h2>
          {canManage ? <GenerateClientInvoiceMenu orderNumber={orderNumber} tradeId={tradeId} /> : null}
        </div>

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
                    <TableHead>Total (USD)</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        <ClientTypeBadge type={invoice.invoice_type} />
                      </TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell>{formatUsd(invoice.total_usd)}</TableCell>
                      <TableCell>
                        {invoice.pdf_onedrive_url ? (
                          <a
                            download
                            className="font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                            href={buildDownloadUrl(invoice.pdf_onedrive_url, `invoice-${invoice.invoice_number}.pdf`)}
                          >
                            Download
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canManage ? <SendInvoiceButton invoice={invoice} /> : null}
                          {canManage ? <ClientInvoiceStatusDropdown invoice={invoice} /> : null}
                          {canManage ? <DeleteClientInvoiceButton invoice={invoice} /> : null}
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
            <CardContent className="py-10 text-sm text-slate-500">No client invoices yet.</CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0d1b34]">Supplier Invoices (Outgoing)</h2>
          {canManage ? (
            <GenerateSupplierInvoiceMenu orderNumber={orderNumber} suppliers={suppliers} tradeId={tradeId} />
          ) : null}
        </div>

        {initialSupplierInvoices.length ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total (RMB)</TableHead>
                    <TableHead>USD Equiv.</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead>Supplier Ref</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialSupplierInvoices.map((invoice) => {
                    const adjustments = invoice.adjustments ?? [];

                    return (
                      <Fragment key={invoice.id}>
                        <TableRow>
                          <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            <SupplierTypeBadge type={invoice.invoice_type} />
                          </TableCell>
                          <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                          <TableCell>
                            <StatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell>{formatRmb(invoice.total_rmb)}</TableCell>
                          <TableCell>{invoice.total_usd != null ? formatUsd(invoice.total_usd) : "-"}</TableCell>
                          <TableCell>
                            {invoice.pdf_onedrive_url ? (
                              <a
                                download
                                className="font-medium text-[#0d1b34] underline-offset-4 hover:underline"
                                href={buildDownloadUrl(invoice.pdf_onedrive_url, `invoice-${invoice.invoice_number}.pdf`)}
                              >
                                Download
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <SupplierInvoiceMatchDialog canManage={canManage} invoice={invoice} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canManage ? <SupplierInvoiceStatusDropdown invoice={invoice} /> : null}
                              {canManage ? <DeleteSupplierInvoiceButton invoice={invoice} /> : null}
                            </div>
                          </TableCell>
                        </TableRow>
                        {invoice.invoice_type === "final" && adjustments.length ? (
                          <TableRow className="bg-slate-50">
                            <TableCell colSpan={9}>
                              <div className="space-y-2 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Adjustments
                                </p>
                                <div className="space-y-1">
                                  {adjustments.map((adjustment) => (
                                    <div
                                      className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                                      key={adjustment.id}
                                    >
                                      <span className="text-[#0d1b34]">{adjustment.description}</span>
                                      <span className="font-medium text-[#0d1b34]">{formatRmb(adjustment.amount_rmb)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-10 text-sm text-slate-500">No supplier invoices yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
