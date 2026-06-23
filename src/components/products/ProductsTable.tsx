"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
type ProductsTableMode = "products" | "sets" | "inactive";

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

function LinkedCell({
  children,
  className = "",
  href,
}: {
  children: string | null | undefined;
  className?: string;
  href: string;
}) {
  if (!children) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <Link className={`transition-colors hover:text-blue-700 hover:underline ${className}`} href={href}>
      {children}
    </Link>
  );
}

export function ProductsTable({
  backHref = "/products?tab=products",
  mode = "products",
  products,
}: {
  backHref?: string;
  mode?: ProductsTableMode;
  products: Product[];
}) {
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const detailHref = (productId: string) => `/products/${productId}?from=${encodeURIComponent(backHref)}`;

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.code.toLowerCase().includes(normalizedSearch) ||
        (product.supplier_product_code ?? "").toLowerCase().includes(normalizedSearch) ||
        product.name_english.toLowerCase().includes(normalizedSearch) ||
        (product.name_chinese ?? "").toLowerCase().includes(normalizedSearch);

      const matchesPayment = mode !== "products" || paymentFilter === "all" || product.payment_category === paymentFilter;

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
        {mode === "products" ? (
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
            <TableHead>Rock Hill Code</TableHead>
            {mode !== "sets" ? <TableHead>Supplier Code</TableHead> : null}
            <TableHead>English Name</TableHead>
            <TableHead>Chinese Name</TableHead>
            {mode !== "sets" ? <TableHead>Supplier</TableHead> : null}
            {mode === "sets" ? <TableHead>Components</TableHead> : <TableHead>Payment Category</TableHead>}
            {mode === "inactive" ? <TableHead>Type</TableHead> : null}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.length ? (
            filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-semibold text-[#0d1b34]">
                  <LinkedCell className="font-semibold" href={detailHref(product.id)}>
                    {product.code}
                  </LinkedCell>
                </TableCell>
                {mode !== "sets" ? (
                  <TableCell>
                    <LinkedCell href={detailHref(product.id)}>{product.supplier_product_code}</LinkedCell>
                  </TableCell>
                ) : null}
                <TableCell>
                  <LinkedCell href={detailHref(product.id)}>{product.name_english}</LinkedCell>
                </TableCell>
                <TableCell>
                  <LinkedCell href={detailHref(product.id)}>{product.name_chinese}</LinkedCell>
                </TableCell>
                {mode !== "sets" ? <TableCell>{product.supplier?.code ?? "-"}</TableCell> : null}
                {mode === "sets" ? (
                  <TableCell>{product.components?.length ?? 0} products</TableCell>
                ) : (
                  <TableCell>
                    <PaymentCategoryBadge category={product.payment_category} />
                  </TableCell>
                )}
                {mode === "inactive" ? <TableCell>{product.product_type === "set" ? "Set" : "Product"}</TableCell> : null}
                <TableCell>
                  <StatusBadge status={product.status} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={mode === "sets" ? 5 : mode === "inactive" ? 8 : 7}>
                {mode === "products" ? "No products yet." : mode === "sets" ? "No sets yet." : "No inactive items."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
