import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { ClientStatusButton } from "@/components/clients/ClientStatusButton";
import { ContactsEditor } from "@/components/clients/ContactsEditor";
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
      {status}
    </Badge>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-[#0d1b34]">{value || "—"}</p>
    </div>
  );
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (user?.role === "partner") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Client profiles are available to admins and managers only.</p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", params.id).maybeSingle();

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

  const client = data as Client;

  return (
    <section className="space-y-6">
      <div>
        <Link className="text-sm font-medium text-slate-500 transition-colors hover:text-[#0d1b34]" href="/clients">
          ← Clients
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-[#0d1b34]">{client.name}</h1>
          <StatusBadge status={client.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Main Info</CardTitle>
              <ClientFormDialog
                initialData={client}
                mode="edit"
                trigger={
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <DetailRow label="Company Name" value={client.name} />
                <DetailRow label="Client Code" value={client.code} />
                <DetailRow label="Country" value={client.country} />
                <DetailRow label="Currency" value={client.currency} />
                <DetailRow label="Deposit %" value={`${client.deposit_pct}%`} />
                <DetailRow label="Final %" value={`${client.final_pct}%`} />
              </div>
              <DetailRow label="Address" value={client.address} />
              <DetailRow label="Notes" value={client.notes} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactsEditor clientId={client.id} initialContacts={client.contacts ?? []} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <StatusBadge status={client.status} />
                  <ClientStatusButton clientId={client.id} status={client.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</p>
                <p className="mt-1 text-sm text-[#0d1b34]">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                  }).format(new Date(client.created_at))}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
