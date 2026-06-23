"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProduct, saveSetComponents, updateProduct } from "@/app/actions/products";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Product } from "@/types";

export type ProductSupplierOption = {
  id: string;
  name: string;
  code: string;
};

type ProductFormDialogProps = {
  mode: "create" | "edit";
  suppliers: ProductSupplierOption[];
  availableProducts?: Product[];
  defaultProductType?: Product["product_type"];
  initialData?: Product;
  trigger?: ReactNode;
};

type SetComponentDraft = {
  rowKey: string;
  component_product_id: string;
  quantity_per_set: number;
  component: Product | null;
};

export function ProductFormDialog({
  availableProducts = [],
  mode,
  suppliers,
  defaultProductType = "part",
  initialData,
  trigger,
}: ProductFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productType, setProductType] = useState<Product["product_type"]>(
    initialData?.product_type ?? defaultProductType
  );
  const [supplierId, setSupplierId] = useState(initialData?.supplier_id ?? "none");
  const [paymentCategory, setPaymentCategory] = useState<Product["payment_category"]>(
    initialData?.payment_category ?? "outsourced"
  );
  const [packagingRequired, setPackagingRequired] = useState(initialData?.packaging_required ?? false);
  const [qtyPerCarton, setQtyPerCarton] = useState(initialData?.qty_per_carton?.toString() ?? "");
  const [cartonsPerPallet, setCartonsPerPallet] = useState(initialData?.cartons_per_pallet?.toString() ?? "");
  const [setComponentRows, setSetComponentRows] = useState<SetComponentDraft[]>([]);
  const [isPending, startTransition] = useTransition();
  const qtyItemsPerPallet = Number(qtyPerCarton) > 0 && Number(cartonsPerPallet) > 0
    ? Number(qtyPerCarton) * Number(cartonsPerPallet)
    : null;

  useEffect(() => {
    if (open) {
      setError(null);
      setProductType(initialData?.product_type ?? defaultProductType);
      setSupplierId(initialData?.supplier_id ?? "none");
      setPaymentCategory(initialData?.payment_category ?? "outsourced");
      setPackagingRequired(initialData?.packaging_required ?? false);
      setQtyPerCarton(initialData?.qty_per_carton?.toString() ?? "");
      setCartonsPerPallet(initialData?.cartons_per_pallet?.toString() ?? "");
      setSetComponentRows([]);
    }
  }, [defaultProductType, initialData, open]);

  function addSetComponentRow() {
    setSetComponentRows((currentRows) => [
      ...currentRows,
      {
        rowKey: crypto.randomUUID(),
        component: null,
        component_product_id: "",
        quantity_per_set: 1,
      },
    ]);
  }

  function updateSetComponent(index: number, productId: string) {
    const product = availableProducts.find((availableProduct) => availableProduct.id === productId) ?? null;

    setSetComponentRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              component: product,
              component_product_id: product?.id ?? "",
            }
          : row
      )
    );
  }

  function updateSetComponentQty(index: number, quantity: number) {
    setSetComponentRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, quantity_per_set: quantity > 0 ? quantity : 1 } : row
      )
    );
  }

  function removeSetComponentRow(index: number) {
    setSetComponentRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index));
  }

  function validateSetComponents() {
    if (productType !== "set" || mode !== "create" || !setComponentRows.length) {
      return null;
    }

    const selectedIds = setComponentRows.map((row) => row.component_product_id).filter(Boolean);
    const uniqueIds = new Set(selectedIds);

    if (selectedIds.length !== setComponentRows.length) {
      return "Select an English name for every component row";
    }

    if (uniqueIds.size !== selectedIds.length) {
      return "A component can only be added once";
    }

    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("product_type", productType);
    formData.set("supplier_id", supplierId);
    formData.set("payment_category", productType === "part" ? paymentCategory ?? "" : "");
    formData.set("packaging_required", packagingRequired ? "true" : "false");

    startTransition(async () => {
      const componentError = validateSetComponents();

      if (componentError) {
        setError(componentError);
        return;
      }

      const result =
        mode === "create" ? await createProduct(formData) : await updateProduct(initialData?.id ?? "", formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (mode === "create" && productType === "set" && result.id && setComponentRows.length) {
        const componentResult = await saveSetComponents(
          result.id,
          setComponentRows.map((row, index) => ({
            component_product_id: row.component_product_id,
            quantity_per_set: row.quantity_per_set,
            sort_order: index + 1,
          }))
        );

        if (componentResult.error) {
          setError(componentResult.error);
          return;
        }
      }

      setOpen(false);
      toast.success(mode === "create" ? "Product created successfully" : "Product updated successfully");
      router.refresh();

      if (mode === "create" && result.id) {
        router.push(`/products/${result.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
            <Plus className="mr-2 h-4 w-4" />
            {defaultProductType === "set" ? "Add Set" : "Add Product"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Product" : "Edit Product"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create a new product profile." : "Update this product profile."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <section className="space-y-4 rounded-lg border-2 border-slate-300 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">Edit Product</h3>
            <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Rock Hill Product Code</Label>
              <Input
                className="uppercase"
                defaultValue={initialData?.code ?? ""}
                disabled={isPending}
                id="code"
                name="code"
                onChange={(event) => {
                  event.currentTarget.value = event.currentTarget.value.toUpperCase();
                }}
                required
              />
            </div>
            {productType === "part" ? (
              <div className="space-y-2">
                <Label htmlFor="supplier_product_code">Supplier Product Code</Label>
                <Input
                  defaultValue={initialData?.supplier_product_code ?? ""}
                  disabled={isPending}
                  id="supplier_product_code"
                  name="supplier_product_code"
                  placeholder="Code shown on supplier quote/invoice"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="name_english">English Name</Label>
              <Input
                defaultValue={initialData?.name_english ?? ""}
                disabled={isPending}
                id="name_english"
                name="name_english"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_chinese">Chinese Name</Label>
              <Input
                defaultValue={initialData?.name_chinese ?? ""}
                disabled={isPending}
                id="name_chinese"
                name="name_chinese"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_type">Product Type</Label>
              <Select
                disabled={isPending}
                onValueChange={(value: Product["product_type"]) => setProductType(value)}
                value={productType}
              >
                <SelectTrigger id="product_type">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="part">Product</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Supplier</Label>
              <Select disabled={isPending} onValueChange={setSupplierId} value={supplierId}>
                <SelectTrigger id="supplier_id">
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
            {productType === "part" ? (
              <div className="space-y-2">
                <Label htmlFor="payment_category">Source</Label>
                <Select
                  disabled={isPending}
                  onValueChange={(value: NonNullable<Product["payment_category"]>) => setPaymentCategory(value)}
                  value={paymentCategory ?? "outsourced"}
                >
                  <SelectTrigger id="payment_category">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outsourced">Outsourced</SelectItem>
                    <SelectItem value="produced">Produced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea defaultValue={initialData?.notes ?? ""} disabled={isPending} id="notes" name="notes" />
            </div>
          </section>

          {mode === "create" && productType === "set" ? (
            <section className="space-y-4 rounded-lg border-2 border-slate-300 p-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">Set Components</h3>
                <p className="text-xs text-slate-500">Select each product in the set and enter the quantity needed.</p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rock Hill Code</TableHead>
                    <TableHead>Product English Name</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="w-32">Qty Needed</TableHead>
                    <TableHead className="w-16 text-right">Remove</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {setComponentRows.length ? (
                    setComponentRows.map((row, index) => (
                      <TableRow key={row.rowKey}>
                        <TableCell className="font-semibold text-[#0d1b34]">{row.component?.code ?? "-"}</TableCell>
                        <TableCell>
                          <Select
                            disabled={isPending}
                            onValueChange={(value) => updateSetComponent(index, value)}
                            value={row.component_product_id}
                          >
                            <SelectTrigger className="min-w-64 bg-white">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableProducts
                                .filter((product) => {
                                  if (product.id === row.component_product_id) {
                                    return true;
                                  }

                                  return !setComponentRows.some(
                                    (existingRow, rowIndex) =>
                                      rowIndex !== index && existingRow.component_product_id === product.id
                                  );
                                })
                                .sort((a, b) => a.name_english.localeCompare(b.name_english))
                                .map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name_english}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{row.component?.supplier?.code ?? "-"}</TableCell>
                        <TableCell>
                          <Input
                            className="w-24"
                            disabled={isPending}
                            min={1}
                            onChange={(event) =>
                              updateSetComponentQty(index, Number(event.currentTarget.value) || 1)
                            }
                            type="number"
                            value={row.quantity_per_set}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            aria-label="Remove component"
                            disabled={isPending}
                            onClick={() => removeSetComponentRow(index)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="text-slate-500" colSpan={5}>
                        No components added yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex justify-start">
                <Button
                  disabled={isPending || setComponentRows.length >= availableProducts.length}
                  onClick={addSetComponentRow}
                  type="button"
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Component Row
                </Button>
              </div>
            </section>
          ) : null}

          <section className="space-y-3 rounded-lg border-2 border-slate-300 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">Packaging Information</h3>
                <p className="text-xs text-slate-500">Carton and pallet details for shipping and production planning.</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-[#0d1b34]">
                <input
                  checked={packagingRequired}
                  className="h-4 w-4 rounded border-slate-300"
                  disabled={isPending}
                  onChange={(event) => setPackagingRequired(event.target.checked)}
                  type="checkbox"
                />
                Has packaging info
              </label>
            </div>
            {packagingRequired ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="qty_per_carton">Qty per Carton</Label>
                    <Input
                      className="w-32"
                      defaultValue={initialData?.qty_per_carton ?? ""}
                      disabled={isPending}
                      id="qty_per_carton"
                      min="0"
                      name="qty_per_carton"
                      onChange={(event) => setQtyPerCarton(event.target.value)}
                      step="1"
                      type="number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Carton Dimensions (cm)</Label>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        aria-label="Carton height in cm"
                        className="w-24"
                        defaultValue={initialData?.carton_height_cm ?? ""}
                        disabled={isPending}
                        max="999.99"
                        min="0"
                        name="carton_height_cm"
                        placeholder="H cm"
                        step="0.01"
                        type="number"
                      />
                      <Input
                        aria-label="Carton width in cm"
                        className="w-24"
                        defaultValue={initialData?.carton_width_cm ?? ""}
                        disabled={isPending}
                        max="999.99"
                        min="0"
                        name="carton_width_cm"
                        placeholder="W cm"
                        step="0.01"
                        type="number"
                      />
                      <Input
                        aria-label="Carton length in cm"
                        className="w-24"
                        defaultValue={initialData?.carton_length_cm ?? ""}
                        disabled={isPending}
                        max="999.99"
                        min="0"
                        name="carton_length_cm"
                        placeholder="L cm"
                        step="0.01"
                        type="number"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="carton_weight_kg">Carton Weight (kg)</Label>
                    <Input
                      defaultValue={initialData?.carton_weight_kg ?? ""}
                      disabled={isPending}
                      id="carton_weight_kg"
                      min="0"
                      name="carton_weight_kg"
                      step="0.01"
                      type="number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cartons_per_pallet">Cartons per Pallet</Label>
                    <Input
                      defaultValue={initialData?.cartons_per_pallet ?? ""}
                      disabled={isPending}
                      id="cartons_per_pallet"
                      min="0"
                      name="cartons_per_pallet"
                      onChange={(event) => setCartonsPerPallet(event.target.value)}
                      step="1"
                      type="number"
                    />
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qty Items per Pallet</p>
                    <p className="mt-1 text-sm font-semibold text-[#0d1b34]">
                      {qtyItemsPerPallet ? qtyItemsPerPallet.toLocaleString() : "-"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "create" ? (productType === "set" ? "Create Set" : "Create Product") : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
