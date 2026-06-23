import Link from "next/link";

import { VendorFormDialog } from "@/components/vendors/VendorFormDialog";
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
      {status}
    </Badge>
  );
}

function VendorTypeBadge({ type }: { type: ExpenseVendor["vendor_type"] }) {
  return (
    <Badge className={vendorTypeClasses[type]} variant="outline">
      {vendorTypeLabels[type]}
    </Badge>
  );
}

export default async function VendorsPage() {
  const user = await getCurrentUser();

  if (user?.role === "partner") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Expense vendors are available to admins and managers only.</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Companies</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">Vendors</h1>
        </div>
        <VendorFormDialog mode="create" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Expense Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Letterhead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vendors as ExpenseVendor[]).length ? (
                (vendors as ExpenseVendor[]).map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-semibold text-[#0d1b34]">{vendor.code}</TableCell>
                    <TableCell>
                      <VendorTypeBadge type={vendor.vendor_type} />
                    </TableCell>
                    <TableCell>{vendor.country ?? "—"}</TableCell>
                    <TableCell>
                      {vendor.letterhead_onedrive_url ? (
                        <span className="text-sm font-medium text-green-700">Linked</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={vendor.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/vendors/${vendor.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={6}>
                    No vendors yet.
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
