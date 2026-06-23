"use client";

import { BarChart2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PriceHistoryRow = {
  id: string;
  unit_price_rmb: number;
  quantity: number;
  payment_category: string | null;
  session_number: number;
  quote_date: string;
  session_status: "draft" | "confirmed" | "superseded" | string;
  trade_id: string;
  trade_code: string;
  product_code: string;
  product_name: string;
};

const statusClasses: Record<string, string> = {
  confirmed: "border-green-200 bg-green-50 text-green-700",
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  superseded: "border-red-200 bg-red-50 text-red-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatRmb(value: number) {
  return `\u00A5${value.toFixed(2)}`;
}

function formatChange(current: number, previous?: number) {
  if (previous === undefined) {
    return { className: "text-slate-400", label: "-" };
  }

  const change = current - previous;

  if (Math.abs(change) < 0.005) {
    return { className: "text-slate-400", label: "-" };
  }

  return {
    className: change > 0 ? "font-medium text-red-600" : "font-medium text-green-600",
    label: `${change > 0 ? "+" : "-"}${formatRmb(Math.abs(change))}`,
  };
}

export function PriceHistoryDialog({
  onOpenChange,
  open,
  productCode,
  productId,
  productName,
  trigger,
}: {
  productId: string;
  productName: string;
  productCode: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<PriceHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    async function loadHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/quote-price-history?productId=${productId}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load price history");
        }

        if (isMounted) {
          setHistory(payload.history ?? []);
        }
      } catch (caughtError) {
        if (isMounted) {
          setHistory([]);
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load price history");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, productId]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger === null ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button aria-label="Price History" size="icon" title="Price History" type="button" variant="ghost">
              <BarChart2 className="h-4 w-4" />
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Price History - {productCode} {productName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : history.length ? (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit Price (RMB)</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row, index) => {
                  const change = formatChange(row.unit_price_rmb, history[index + 1]?.unit_price_rmb);

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.trade_code}</TableCell>
                      <TableCell>Round {row.session_number}</TableCell>
                      <TableCell>{formatDate(row.quote_date)}</TableCell>
                      <TableCell>
                        <Badge className={statusClasses[row.session_status] ?? statusClasses.draft} variant="outline">
                          {row.session_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{formatRmb(row.unit_price_rmb)}</TableCell>
                      <TableCell className={change.className}>{change.label}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border border-slate-200 p-6 text-sm text-slate-500">
            No price history found for this product.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
