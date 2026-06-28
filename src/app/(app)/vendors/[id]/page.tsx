import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronsLeft } from "lucide-react";

import { LetterheadEditor } from "@/components/vendors/LetterheadEditor";
import { VendorContactsEditor } from "@/components/vendors/VendorContactsEditor";
import { VendorFormDialog } from "@/components/vendors/VendorFormDialog";
import { VendorStatusButton } from "@/components/vendors/VendorStatusButton";
import { T } from "@/components/i18n/T";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExpenseVendor } from "@/types";

const vendorTypeLabels: Record<ExpenseVendor["vendor_type"], string> = {
  legal: "Legal",
  consulting: "Consulting",
  maintenance: "Maintenance",
  related_company: "Related Company",
};

const vendorTypeClasses: Record<ExpenseVendor["vendor_type"], string> = {
  legal: "border-amber-200 bg-amber-50 text-amber-700",
  consulting: "border-violet-200 bg-violet-50 text-violet-700",
  maintenance: "border-blue-200 bg-blue-50 text-blue-700",
  related_company: "border-slate-200 bg-slate-100 text-slate-700",
};

const vendorTypeTranslationKeys: Record<ExpenseVendor["vendor_type"], string> = {
  legal: "vendors.legal",
  consulting: "vendors.consulting",
  maintenance: "vendors.maintenance",
  related_company: "vendors.relatedCompany",
};

function StatusBadge({ status }: { status: ExpenseVendor["status"] }) {
  return (
    <Badge className={status === "active" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"} variant="outline">
      <T k={`status.${status}`} fallback={status} />
    </Badge>
  );
}

function VendorTypeBadge({ type }: { type: ExpenseVendor["vendor_type"] }) {
  return <Badge className={vendorTypeClasses[type]} variant="outline"><T k={vendorTypeTranslationKeys[type]} fallback={vendorTypeLabels[type]} /></Badge>;
}

function DetailRow({ label, value }: { label: React.ReactNode; value: string | number | null }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-[#0d1b34]">{value || "-"}</p>
    </div>
  );
}

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user || user.role === "partner" || user.role === "user") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]"><T k="common.accessDenied" fallback="Access denied" /></h1>
          <p className="mt-2 text-sm text-slate-500"><T k="vendors.accessDeniedHelp" fallback="Expense vendors are available to admins and managers only." /></p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("expense_vendors").select("*").eq("id", params.id).maybeSingle();

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error.message}</div>;
  if (!data) notFound();

  const vendor = data as ExpenseVendor;
  const canEdit = user.role === "admin";

  return (
    <section className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-[#0d1b34]"
          href="/vendors"
        >
          <ChevronsLeft className="h-4 w-4" />
          <T k="vendors.title" fallback="Vendors" />
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-[#0d1b34]">{vendor.code}</h1>
          <StatusBadge status={vendor.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle><T k="common.mainInfo" fallback="Main Info" /></CardTitle>
              {canEdit ? (
                <VendorFormDialog initialData={vendor} mode="edit" trigger={<Button size="sm" variant="outline"><T k="common.edit" fallback="Edit" /></Button>} />
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <DetailRow label={<T k="vendors.vendorCode" fallback="Vendor Code" />} value={vendor.code} />
                <DetailRow label={<T k="vendors.fullName" fallback="Full Name" />} value={vendor.name} />
                <DetailRow label={<T k="table.country" fallback="Country" />} value={vendor.country} />
                <div className="border-b border-slate-100 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500"><T k="vendors.vendorType" fallback="Vendor Type" /></p>
                  <div className="mt-1"><VendorTypeBadge type={vendor.vendor_type} /></div>
                </div>
              </div>
              <DetailRow label={<T k="table.address" fallback="Address" />} value={vendor.address} />
              <DetailRow label={<T k="table.notes" fallback="Notes" />} value={vendor.notes} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle><T k="vendors.letterhead" fallback="Letterhead" /></CardTitle></CardHeader>
            <CardContent>{canEdit ? <LetterheadEditor letterheadUrl={vendor.letterhead_onedrive_url} vendorId={vendor.id} /> : vendor.letterhead_onedrive_url ? <a className="text-sm font-medium text-[#0d1b34] underline-offset-4 hover:underline" href={vendor.letterhead_onedrive_url} rel="noreferrer" target="_blank">{vendor.letterhead_onedrive_url}</a> : <p className="text-sm text-slate-500">No letterhead linked yet.</p>}</CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle><T k="common.bankingInformation" fallback="Banking Information" /></CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <DetailRow label={<T k="table.accountName" fallback="Account Name" />} value={vendor.bank_account_name} />
                <DetailRow label={<T k="table.accountNumber" fallback="Account Number" />} value={vendor.bank_account_number} />
                <DetailRow label={<T k="table.bankName" fallback="Bank Name" />} value={vendor.bank_name} />
                <DetailRow label={<T k="table.currency" fallback="Currency" />} value={vendor.bank_currency} />
                <DetailRow label={<T k="table.swiftBic" fallback="SWIFT / BIC" />} value={vendor.bank_swift_code} />
                <DetailRow label={<T k="table.abaRouting" fallback="ABA Routing" />} value={vendor.bank_aba_routing} />
              </div>
              <DetailRow label={<T k="table.bankAddress" fallback="Bank Address" />} value={vendor.bank_address} />
              <DetailRow label={<T k="vendors.specialInstructions" fallback="Special Instructions" />} value={vendor.banking_instructions} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle><T k="common.contacts" fallback="Contacts" /></CardTitle></CardHeader>
            <CardContent><VendorContactsEditor initialContacts={vendor.contacts ?? []} vendorId={vendor.id} /></CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle><T k="common.profile" fallback="Profile" /></CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500"><T k="table.status" fallback="Status" /></p>
                <div className="mt-2 flex items-center justify-between gap-3"><StatusBadge status={vendor.status} />{canEdit ? <VendorStatusButton status={vendor.status} vendorId={vendor.id} /> : null}</div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500"><T k="table.created" fallback="Created" /></p>
                <p className="mt-1 text-sm text-[#0d1b34]">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(vendor.created_at))}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
