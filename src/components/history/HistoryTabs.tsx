"use client";

import { Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createCostHistory,
  createQuoteHistory,
  deleteCostHistory,
  deleteQuoteHistory,
  updateCostHistory,
  updateQuoteHistory,
} from "@/app/actions/history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ProductOption = {
  id: string;
  code: string;
  supplier_product_code: string | null;
  name_english: string;
  name_chinese: string | null;
};

type SupplierOption = {
  id: string;
  code: string;
  name: string;
};

type QuoteSessionOption = {
  id: string;
  session_number: number;
  quote_date: string;
  status: "draft" | "confirmed" | "superseded";
  trade?: { id: string; trade_id: string } | null;
};

type CostHistoryRow = {
  id: string;
  product_id: string;
  supplier_id: string | null;
  supplier_product_code: string | null;
  quoted_date: string;
  unit_cost_rmb: number;
  moq: string | null;
  quality: string | null;
  carton_box_packaging: string | null;
  source: string;
  notes: string | null;
  product?: ProductOption | null;
  supplier?: SupplierOption | null;
};

type QuoteHistoryRow = {
  id: string;
  session_id: string;
  product_id: string | null;
  item_name_chinese: string | null;
  item_name_english: string | null;
  quantity: number;
  unit_price_rmb: number;
  total_price_rmb: number;
  payment_category: "outsourced" | "produced" | "misc_expense" | null;
  notes: string | null;
  sort_order: number;
  product?: ProductOption | null;
  session?: QuoteSessionOption | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatRmb(value: number | null | undefined) {
  return typeof value === "number" ? `¥${value.toFixed(4)}` : "-";
}

function StatusBadge({ status }: { status: QuoteSessionOption["status"] }) {
  const classes = {
    confirmed: "border-green-200 bg-green-50 text-green-700",
    draft: "border-slate-200 bg-slate-100 text-slate-700",
    superseded: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <Badge className={classes[status]} variant="outline">
      {status}
    </Badge>
  );
}

function DeleteButton({
  action,
  label,
}: {
  action: () => Promise<{ success?: true; error?: string }>;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete this ${label}?`)) {
      return;
    }

    startTransition(async () => {
      const result = await action();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`${label} deleted`);
      router.refresh();
    });
  }

  return (
    <Button disabled={isPending} onClick={handleDelete} size="icon" type="button" variant="ghost">
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}

function CostHistoryDialog({
  children,
  cost,
  products,
  suppliers,
}: {
  children: ReactNode;
  cost?: CostHistoryRow;
  products: ProductOption[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = cost ? await updateCostHistory(cost.id, formData) : await createCostHistory(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(cost ? "Cost history updated" : "Cost history added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{cost ? "Edit Cost History" : "Add Cost History"}</DialogTitle>
          <DialogDescription>Manual product cost row.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Product</Label>
            <Select defaultValue={cost?.product_id} disabled={isPending} name="product_id" required>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.code} - {product.name_english}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select defaultValue={cost?.supplier_id ?? "none"} disabled={isPending} name="supplier_id">
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier_product_code">Supplier Code</Label>
            <Input
              defaultValue={cost?.supplier_product_code ?? ""}
              disabled={isPending}
              id="supplier_product_code"
              name="supplier_product_code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quoted_date">Date</Label>
            <Input
              defaultValue={cost?.quoted_date ?? new Date().toISOString().slice(0, 10)}
              disabled={isPending}
              id="quoted_date"
              name="quoted_date"
              required
              type="date"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit_cost_rmb">Unit (RMB)</Label>
            <Input
              defaultValue={cost?.unit_cost_rmb ?? ""}
              disabled={isPending}
              id="unit_cost_rmb"
              min="0"
              name="unit_cost_rmb"
              required
              step="0.0001"
              type="number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moq">MOQ</Label>
            <Input defaultValue={cost?.moq ?? ""} disabled={isPending} id="moq" name="moq" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quality">Quality</Label>
            <Input defaultValue={cost?.quality ?? ""} disabled={isPending} id="quality" name="quality" />
          </div>
          <label className="flex items-center gap-2 pt-8 text-sm font-medium text-[#0d1b34]">
            <input
              defaultChecked={Boolean(cost?.carton_box_packaging)}
              disabled={isPending}
              name="carton_box_packaging"
              type="checkbox"
              value="true"
            />
            Carton
          </label>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="source">Source</Label>
            <Input defaultValue={cost?.source ?? "manual"} disabled={isPending} id="source" name="source" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={cost?.notes ?? ""} disabled={isPending} id="notes" name="notes" />
          </div>
          {error ? <p className="text-sm font-medium text-red-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuoteHistoryDialog({
  children,
  products,
  quote,
  sessions,
}: {
  children: ReactNode;
  products: ProductOption[];
  quote?: QuoteHistoryRow;
  sessions: QuoteSessionOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = quote ? await updateQuoteHistory(quote.id, formData) : await createQuoteHistory(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(quote ? "Quote history updated" : "Quote history added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{quote ? "Edit Quote History" : "Add Quote History"}</DialogTitle>
          <DialogDescription>Manual supplier quote line.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2 sm:col-span-2">
            <Label>Quote Session</Label>
            <Select defaultValue={quote?.session_id} disabled={isPending} name="session_id" required>
              <SelectTrigger>
                <SelectValue placeholder="Select quote session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.trade?.trade_id ?? "Trade"} - Round {session.session_number} - {session.quote_date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Product</Label>
            <Select defaultValue={quote?.product_id ?? "none"} disabled={isPending} name="product_id">
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.code} - {product.name_english}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_category">Source</Label>
            <Select defaultValue={quote?.payment_category ?? "none"} disabled={isPending} name="payment_category">
              <SelectTrigger id="payment_category">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="outsourced">Outsourced</SelectItem>
                <SelectItem value="produced">Produced</SelectItem>
                <SelectItem value="misc_expense">Misc Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item_name_english">English Name</Label>
            <Input
              defaultValue={quote?.item_name_english ?? ""}
              disabled={isPending}
              id="item_name_english"
              name="item_name_english"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item_name_chinese">Chinese Name</Label>
            <Input
              defaultValue={quote?.item_name_chinese ?? ""}
              disabled={isPending}
              id="item_name_chinese"
              name="item_name_chinese"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Qty</Label>
            <Input
              defaultValue={quote?.quantity ?? 1}
              disabled={isPending}
              id="quantity"
              min="0.0001"
              name="quantity"
              required
              step="0.0001"
              type="number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit_price_rmb">Unit (RMB)</Label>
            <Input
              defaultValue={quote?.unit_price_rmb ?? ""}
              disabled={isPending}
              id="unit_price_rmb"
              min="0"
              name="unit_price_rmb"
              required
              step="0.0001"
              type="number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sort_order">Sort</Label>
            <Input
              defaultValue={quote?.sort_order ?? 0}
              disabled={isPending}
              id="sort_order"
              min="0"
              name="sort_order"
              step="1"
              type="number"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={quote?.notes ?? ""} disabled={isPending} id="notes" name="notes" />
          </div>
          {error ? <p className="text-sm font-medium text-red-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function HistoryTabs({
  costRows,
  products,
  quoteRows,
  sessions,
  suppliers,
}: {
  costRows: CostHistoryRow[];
  products: ProductOption[];
  quoteRows: QuoteHistoryRow[];
  sessions: QuoteSessionOption[];
  suppliers: SupplierOption[];
}) {
  const sortedQuotes = useMemo(
    () =>
      [...quoteRows].sort((a, b) => {
        const dateA = a.session?.quote_date ?? "";
        const dateB = b.session?.quote_date ?? "";
        return dateB.localeCompare(dateA) || (a.session?.trade?.trade_id ?? "").localeCompare(b.session?.trade?.trade_id ?? "");
      }),
    [quoteRows]
  );

  return (
    <Tabs className="space-y-4" defaultValue="cost">
      <TabsList>
        <TabsTrigger value="cost">Cost History</TabsTrigger>
        <TabsTrigger value="quote">Quote History</TabsTrigger>
      </TabsList>

      <TabsContent value="cost">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-[#0d1b34]">Cost History</h2>
            <CostHistoryDialog products={products} suppliers={suppliers}>
              <Button className="bg-[#0d1b34] hover:bg-[#13294d]" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Cost
              </Button>
            </CostHistoryDialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Rock Hill Code</TableHead>
                <TableHead>Supplier Code</TableHead>
                <TableHead>MOQ</TableHead>
                <TableHead className="text-right">Unit (RMB)</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Carton</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costRows.length ? (
                costRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.quoted_date)}</TableCell>
                    <TableCell>{row.product?.code ?? "-"}</TableCell>
                    <TableCell>{row.supplier_product_code ?? row.supplier?.code ?? "-"}</TableCell>
                    <TableCell>{row.moq ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium">{formatRmb(row.unit_cost_rmb)}</TableCell>
                    <TableCell>{row.quality ?? "-"}</TableCell>
                    <TableCell>{row.carton_box_packaging ? "Yes" : "No"}</TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <CostHistoryDialog cost={row} products={products} suppliers={suppliers}>
                          <Button size="icon" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </CostHistoryDialog>
                        <DeleteButton action={() => deleteCostHistory(row.id, row.product_id)} label="cost history" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={9}>
                    No cost history yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="quote">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-[#0d1b34]">Quote History</h2>
            <QuoteHistoryDialog products={products} sessions={sessions}>
              <Button className="bg-[#0d1b34] hover:bg-[#13294d]" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Quote
              </Button>
            </QuoteHistoryDialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>English Name</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit (RMB)</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedQuotes.length ? (
                sortedQuotes.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.session?.quote_date ? formatDate(row.session.quote_date) : "-"}</TableCell>
                    <TableCell>{row.session?.trade?.trade_id ?? "-"}</TableCell>
                    <TableCell>Round {row.session?.session_number ?? "-"}</TableCell>
                    <TableCell>{row.session?.status ? <StatusBadge status={row.session.status} /> : "-"}</TableCell>
                    <TableCell>{row.product?.code ?? "-"}</TableCell>
                    <TableCell>{row.item_name_english ?? row.product?.name_english ?? "-"}</TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right">{formatRmb(row.unit_price_rmb)}</TableCell>
                    <TableCell className="text-right">{formatRmb(row.total_price_rmb)}</TableCell>
                    <TableCell>{row.payment_category ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <QuoteHistoryDialog products={products} quote={row} sessions={sessions}>
                          <Button size="icon" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </QuoteHistoryDialog>
                        <DeleteButton action={() => deleteQuoteHistory(row.id, row.session_id)} label="quote history" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-slate-500" colSpan={11}>
                    No quote history yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
