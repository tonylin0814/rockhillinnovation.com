"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Product } from "@/types";

type PaymentFilter = "all" | "outsourced" | "produced";
type ProductsTableMode = "parts" | "sets";

function StatusBadge({ status }: { status: Product["status"] }) {
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

function PaymentCategoryBadge({ category }: { category: Product["payment_category"] }) {
  if (!category) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <Badge
      className={
        category === "outsourced"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-violet-200 bg-violet-50 text-violet-700"
      }
      variant="outline"
    >
      {category}
    </Badge>
  );
}

export function ProductsTable({ mode = "parts", products }: { mode?: ProductsTableMode; products: Product[] }) {
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.code.toLowerCase().includes(normalizedSearch) ||
        product.name_english.toLowerCase().includes(normalizedSearch) ||
        (product.name_chinese ?? "").toLowerCase().includes(normalizedSearch);

      const matchesPayment = mode === "sets" || paymentFilter === "all" || product.payment_category === paymentFilter;

      return matchesSearch && matchesPayment;
    });
  }, [mode, paymentFilter, products, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          className="sm:max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search code or name..."
          value={search}
        />
        {mode === "parts" ? (
          <Select onValueChange={(value: PaymentFilter) => setPaymentFilter(value)} value={paymentFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Payment category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="outsourced">Outsourced</SelectItem>
              <SelectItem value="produced">Produced</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>English Name</TableHead>
            <TableHead>Chinese Name</TableHead>
            {mode === "parts" ? <TableHead>Supplier</TableHead> : null}
            {mode === "parts" ? <TableHead>Payment Category</TableHead> : <TableHead>Components</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.length ? (
            filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-semibold text-[#0d1b34]">{product.code}</TableCell>
                <TableCell>{product.name_english}</TableCell>
                <TableCell>{product.name_chinese ?? "-"}</TableCell>
                {mode === "parts" ? <TableCell>{product.supplier?.name ?? "-"}</TableCell> : null}
                {mode === "parts" ? (
                  <TableCell>
                    <PaymentCategoryBadge category={product.payment_category} />
                  </TableCell>
                ) : (
                  <TableCell>{product.components?.length ?? 0} parts</TableCell>
                )}
                <TableCell>
                  <StatusBadge status={product.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/products/${product.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={mode === "parts" ? 7 : 6}>
                {mode === "parts" ? "No parts yet." : "No sets yet."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
