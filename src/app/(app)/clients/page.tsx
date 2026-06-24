import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
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

export default async function ClientsPage() {
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
  const { data: clients, error } = await supabase.from("clients").select("*").order("code", { ascending: true });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error.message}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Companies</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">Clients</h1>
        </div>
        <ClientFormDialog mode="create" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Client Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(clients as Client[]).length ? (
                (clients as Client[]).map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-semibold text-[#0d1b34]">
                      <Link className="transition-colors hover:text-blue-700 hover:underline" href={`/clients/${client.id}`}>
                        {client.code}
                      </Link>
                    </TableCell>
                    <TableCell>{client.country ?? "—"}</TableCell>
                    <TableCell>{client.currency}</TableCell>
                    <TableCell>
                      {client.deposit_pct}% / {client.final_pct}%
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={client.status} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={5}>
                    No clients yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
