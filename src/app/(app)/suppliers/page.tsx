import Link from "next/link";

import { T } from "@/components/i18n/T";
import { SupplierFormDialog } from "@/components/suppliers/SupplierFormDialog";
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
  const { data: suppliers, error } = await supabase.from("suppliers").select("*").order("code", { ascending: true });

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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <T k="suppliers.companies" fallback="Companies" />
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">
            <T k="suppliers.title" fallback="Suppliers" />
          </h1>
        </div>
        <SupplierFormDialog mode="create" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>
            <T k="suppliers.profiles" fallback="Supplier Profiles" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T k="suppliers.code" fallback="Code" />
                </TableHead>
                <TableHead>
                  <T k="suppliers.chineseName" fallback="Chinese Name" />
                </TableHead>
                <TableHead>
                  <T k="table.country" fallback="Country" />
                </TableHead>
                <TableHead>
                  <T k="suppliers.invoiceFormat" fallback="Invoice Format" />
                </TableHead>
                <TableHead>
                  <T k="table.status" fallback="Status" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(suppliers as Supplier[]).length ? (
                (suppliers as Supplier[]).map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-semibold text-[#0d1b34]">
                      <Link className="transition-colors hover:text-blue-700 hover:underline" href={`/suppliers/${supplier.id}`}>
                        {supplier.code}
                      </Link>
                    </TableCell>
                    <TableCell>{supplier.name_chinese ?? "—"}</TableCell>
                    <TableCell>{supplier.country ?? "—"}</TableCell>
                    <TableCell>
                      <InvoiceFormatBadge format={supplier.invoice_format} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={supplier.status} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={5}>
                    <T k="suppliers.noSuppliers" fallback="No suppliers yet." />
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
