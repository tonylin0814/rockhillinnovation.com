import Link from "next/link";

import { SupplierFormDialog } from "@/components/suppliers/SupplierFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export default async function SuppliersPage() {
  const user = await getCurrentUser();

  if (user?.role === "partner") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Supplier profiles are available to admins and managers only.</p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: suppliers, error } = await supabase.from("suppliers").select("*").order("name", { ascending: true });

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
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">Suppliers</h1>
        </div>
        <SupplierFormDialog mode="create" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Supplier Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Chinese Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Invoice Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(suppliers as Supplier[]).length ? (
                (suppliers as Supplier[]).map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-semibold text-[#0d1b34]">{supplier.code}</TableCell>
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell>{supplier.name_chinese ?? "—"}</TableCell>
                    <TableCell>{supplier.country ?? "—"}</TableCell>
                    <TableCell>
                      <InvoiceFormatBadge format={supplier.invoice_format} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={supplier.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/suppliers/${supplier.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={7}>
                    No suppliers yet.
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
