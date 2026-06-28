import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronsLeft } from "lucide-react";
import type { ReactNode } from "react";

import { SupplierContactsEditor } from "@/components/suppliers/SupplierContactsEditor";
import { SupplierFormDialog } from "@/components/suppliers/SupplierFormDialog";
import { SupplierStatusButton } from "@/components/suppliers/SupplierStatusButton";
import { T } from "@/components/i18n/T";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Supplier } from "@/types";

function StatusBadge({ status }: { status: Supplier["status"] }) {
  return (
    <Badge
      className={
        status === "active"
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }
      variant="outline"
    >
      {status}
    </Badge>
  );
}

function InvoiceFormatBadge({ format }: { format: Supplier["invoice_format"] }) {
  const classes = {
    image: "border-slate-200 bg-slate-100 text-slate-700",
    excel: "border-blue-200 bg-blue-50 text-blue-700",
    pdf: "border-red-200 bg-red-50 text-red-700",
    word: "border-violet-200 bg-violet-50 text-violet-700",
  }[format];

  return (
    <Badge className={classes} variant="outline">
      {format}
    </Badge>
  );
}

function DetailRow({ label, value }: { label: ReactNode; value: string | number | null }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-[#0d1b34]">{value || "—"}</p>
    </div>
  );
}

export default async function SupplierDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user || user.role === "partner" || user.role === "user") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">
            <T k="common.accessDenied" fallback="Access denied" />
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            <T k="suppliers.accessDeniedHelp" fallback="Supplier profiles are available to admins and managers only." />
          </p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("suppliers").select("*").eq("id", params.id).maybeSingle();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error.message}
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const supplier = data as Supplier;
  const canEdit = user.role === "admin";

  return (
    <section className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-[#0d1b34]"
          href="/suppliers"
        >
          <ChevronsLeft className="h-4 w-4" />
          <T k="suppliers.title" fallback="Suppliers" />
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-[#0d1b34]">{supplier.code}</h1>
          <StatusBadge status={supplier.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle><T k="common.mainInfo" fallback="Main Info" /></CardTitle>
              {canEdit ? (
                <SupplierFormDialog
                  initialData={supplier}
                  mode="edit"
                  trigger={
                    <Button size="sm" variant="outline">
                      <T k="actions.edit" fallback="Edit" />
                    </Button>
                  }
                />
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <DetailRow label={<T k="suppliers.supplierCode" fallback="Supplier Code" />} value={supplier.code} />
                <DetailRow label={<T k="suppliers.englishName" fallback="English Name" />} value={supplier.name} />
                <DetailRow label={<T k="suppliers.chineseName" fallback="Chinese Name" />} value={supplier.name_chinese} />
                <DetailRow label={<T k="table.country" fallback="Country" />} value={supplier.country} />
                <DetailRow label={<T k="suppliers.website" fallback="Website" />} value={supplier.website} />
                <DetailRow label={<T k="suppliers.tel" fallback="TEL" />} value={supplier.tel} />
                <DetailRow label={<T k="table.currency" fallback="Currency" />} value={supplier.currency} />
                <div className="border-b border-slate-100 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <T k="suppliers.invoiceFormat" fallback="Invoice Format" />
                  </p>
                  <div className="mt-1">
                    <InvoiceFormatBadge format={supplier.invoice_format} />
                  </div>
                </div>
              </div>
              <DetailRow label={<T k="table.address" fallback="Address" />} value={supplier.address} />
              <DetailRow label={<T k="suppliers.otherAddress" fallback="Other Address" />} value={supplier.other_address} />
              <DetailRow label={<T k="table.notes" fallback="Notes" />} value={supplier.notes} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle><T k="common.bankingInformation" fallback="Banking Information" /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <DetailRow label={<T k="table.accountName" fallback="Account Name" />} value={supplier.bank_account_name} />
                <DetailRow label={<T k="table.accountNumber" fallback="Account Number" />} value={supplier.bank_account_number} />
                <DetailRow label={<T k="table.currency" fallback="Currency" />} value={supplier.bank_currency} />
                <DetailRow label={<T k="table.bankName" fallback="Bank Name" />} value={supplier.bank_name} />
                <DetailRow label={<T k="table.institutionNo" fallback="Institution No." />} value={supplier.bank_institution_no} />
                <DetailRow label={<T k="table.transitBranchNo" fallback="Transit / Branch No." />} value={supplier.bank_transit_no} />
                <DetailRow label="CNAPS No." value={supplier.bank_cnaps_no} />
                <DetailRow label={<T k="table.swiftCode" fallback="SWIFT Code" />} value={supplier.bank_swift_code} />
                <DetailRow label={<T k="table.bankTel" fallback="Bank TEL" />} value={supplier.bank_tel} />
              </div>
              <DetailRow label={<T k="table.bankAddress" fallback="Bank Address" />} value={supplier.bank_address} />
              <DetailRow label={<T k="suppliers.bankingInstructions" fallback="Banking Instructions" />} value={supplier.banking_instructions} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>
                <T k="common.contacts" fallback="Contacts" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SupplierContactsEditor initialContacts={supplier.contacts ?? []} supplierId={supplier.id} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle><T k="common.profile" fallback="Profile" /></CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <T k="table.status" fallback="Status" />
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <StatusBadge status={supplier.status} />
                  {canEdit ? <SupplierStatusButton status={supplier.status} supplierId={supplier.id} /> : null}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <T k="table.created" fallback="Created" />
                </p>
                <p className="mt-1 text-sm text-[#0d1b34]">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                  }).format(new Date(supplier.created_at))}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
