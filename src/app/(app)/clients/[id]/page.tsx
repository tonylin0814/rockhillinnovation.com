import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronsLeft } from "lucide-react";

import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { ClientStatusButton } from "@/components/clients/ClientStatusButton";
import { ContactsEditor } from "@/components/clients/ContactsEditor";
import { T } from "@/components/i18n/T";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Client } from "@/types";

function StatusBadge({ status }: { status: Client["status"] }) {
  return (
    <Badge
      className={
        status === "active"
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }
      variant="outline"
    >
      <T k={`status.${status}`} fallback={status} />
    </Badge>
  );
}

function DetailRow({ label, value }: { label: React.ReactNode; value: string | number | null }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-[#0d1b34]">{value || "-"}</p>
    </div>
  );
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user || user.role === "partner" || user.role === "user") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]"><T k="common.accessDenied" fallback="Access denied" /></h1>
          <p className="mt-2 text-sm text-slate-500"><T k="clients.accessDeniedHelp" fallback="Client profiles are available to admins and managers only." /></p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", params.id).maybeSingle();

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error.message}</div>;
  }

  if (!data) notFound();

  const client = data as Client;
  const canEdit = user.role === "admin";

  return (
    <section className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-[#0d1b34]"
          href="/clients"
        >
          <ChevronsLeft className="h-4 w-4" />
          <T k="clients.title" fallback="Clients" />
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-[#0d1b34]">{client.code}</h1>
          <StatusBadge status={client.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle><T k="common.mainInfo" fallback="Main Info" /></CardTitle>
              {canEdit ? (
                <ClientFormDialog initialData={client} mode="edit" trigger={<Button size="sm" variant="outline"><T k="common.edit" fallback="Edit" /></Button>} />
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <DetailRow label={<T k="clients.companyName" fallback="Company Name" />} value={client.name} />
                <DetailRow label={<T k="clients.clientCode" fallback="Client Code" />} value={client.code} />
                <DetailRow label={<T k="clients.dbaName" fallback="DBA Name" />} value={client.dba_name} />
                <DetailRow label={<T k="clients.website" fallback="Website" />} value={client.website} />
                <DetailRow label={<T k="table.country" fallback="Country" />} value={client.country} />
                <DetailRow label={<T k="table.currency" fallback="Currency" />} value={client.currency} />
                <DetailRow label={<T k="clients.depositPct" fallback="Deposit %" />} value={`${client.deposit_pct}%`} />
                <DetailRow label={<T k="clients.finalPct" fallback="Final %" />} value={`${client.final_pct}%`} />
              </div>
              <DetailRow label={<T k="table.address" fallback="Address" />} value={client.address} />
              <DetailRow label={<T k="clients.shippingAddress" fallback="Shipping Address" />} value={client.shipping_address} />
              <DetailRow label={<T k="table.notes" fallback="Notes" />} value={client.notes} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle><T k="common.bankingInformation" fallback="Banking Information" /></CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <DetailRow label={<T k="table.bankName" fallback="Bank Name" />} value={client.bank_name} />
                <DetailRow label={<T k="table.bankBranch" fallback="Bank Branch" />} value={client.bank_branch} />
                <DetailRow label={<T k="table.institutionNo" fallback="Institution No." />} value={client.bank_institution_no} />
                <DetailRow label={<T k="table.transitBranchNo" fallback="Transit / Branch No." />} value={client.bank_transit_no} />
                <DetailRow label={<T k="table.accountName" fallback="Account Name" />} value={client.bank_account_name} />
                <DetailRow label={<T k="table.accountNumber" fallback="Account Number" />} value={client.bank_account_number} />
                <DetailRow label={<T k="table.swiftCode" fallback="SWIFT Code" />} value={client.bank_swift_code} />
                <DetailRow label={<T k="table.bankTel" fallback="Bank TEL" />} value={client.bank_tel} />
              </div>
              <DetailRow label={<T k="table.bankAddress" fallback="Bank Address" />} value={client.bank_address} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle><T k="common.contacts" fallback="Contacts" /></CardTitle></CardHeader>
            <CardContent><ContactsEditor clientId={client.id} initialContacts={client.contacts ?? []} /></CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle><T k="common.profile" fallback="Profile" /></CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500"><T k="table.status" fallback="Status" /></p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <StatusBadge status={client.status} />
                  {canEdit ? <ClientStatusButton clientId={client.id} status={client.status} /> : null}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500"><T k="table.created" fallback="Created" /></p>
                <p className="mt-1 text-sm text-[#0d1b34]">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(client.created_at))}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
