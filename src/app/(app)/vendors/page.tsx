import Link from "next/link";

import { VendorFormDialog } from "@/components/vendors/VendorFormDialog";
import { T } from "@/components/i18n/T";
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
import type { ExpenseVendor } from "@/types";

const vendorTypeLabels: Record<ExpenseVendor["vendor_type"], string> = {
  legal: "Legal",
  consulting: "Consulting",
  maintenance: "Maintenance",
  related_company: "Related Company",
};

const vendorTypeTranslationKeys: Record<ExpenseVendor["vendor_type"], string> = {
  legal: "vendors.legal",
  consulting: "vendors.consulting",
  maintenance: "vendors.maintenance",
  related_company: "vendors.relatedCompany",
};

const vendorTypeClasses: Record<ExpenseVendor["vendor_type"], string> = {
  legal: "border-amber-200 bg-amber-50 text-amber-700",
  consulting: "border-violet-200 bg-violet-50 text-violet-700",
  maintenance: "border-blue-200 bg-blue-50 text-blue-700",
  related_company: "border-slate-200 bg-slate-100 text-slate-700",
};

function StatusBadge({ status }: { status: ExpenseVendor["status"] }) {
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

function VendorTypeBadge({ type }: { type: ExpenseVendor["vendor_type"] }) {
  return (
    <Badge className={vendorTypeClasses[type]} variant="outline">
      <T k={vendorTypeTranslationKeys[type]} fallback={vendorTypeLabels[type]} />
    </Badge>
  );
}

export default async function VendorsPage() {
  const user = await getCurrentUser();

  if (!user || user.role === "partner" || user.role === "user") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">
            <T k="common.accessDenied" fallback="Access denied" />
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            <T k="vendors.accessDeniedHelp" fallback="Expense vendors are available to admins and managers only." />
          </p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: vendors, error } = await supabase
    .from("expense_vendors")
    .select("*")
    .order("code", { ascending: true });

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
            <T k="vendors.companies" fallback="Companies" />
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">
            <T k="vendors.title" fallback="Vendors" />
          </h1>
        </div>
        <VendorFormDialog mode="create" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>
            <T k="vendors.profiles" fallback="Expense Vendors" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="vendors.code" fallback="Code" /></TableHead>
                <TableHead><T k="table.type" fallback="Type" /></TableHead>
                <TableHead><T k="table.country" fallback="Country" /></TableHead>
                <TableHead><T k="vendors.letterhead" fallback="Letterhead" /></TableHead>
                <TableHead><T k="table.status" fallback="Status" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vendors as ExpenseVendor[]).length ? (
                (vendors as ExpenseVendor[]).map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-semibold text-[#0d1b34]">
                      <Link className="transition-colors hover:text-blue-700 hover:underline" href={`/vendors/${vendor.id}`}>
                        {vendor.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <VendorTypeBadge type={vendor.vendor_type} />
                    </TableCell>
                    <TableCell>{vendor.country ?? "—"}</TableCell>
                    <TableCell>
                      {vendor.letterhead_onedrive_url ? (
                        <span className="text-sm font-medium text-green-700">
                          <T k="vendors.linked" fallback="Linked" />
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={vendor.status} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={5}>
                    <T k="vendors.noVendors" fallback="No vendors found." />
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
