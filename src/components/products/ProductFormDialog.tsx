"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProduct, updateProduct } from "@/app/actions/products";
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
import type { Product } from "@/types";

export type ProductSupplierOption = {
  id: string;
  name: string;
  code: string;
};

type ProductFormDialogProps = {
  mode: "create" | "edit";
  suppliers: ProductSupplierOption[];
  defaultProductType?: Product["product_type"];
  initialData?: Product;
  trigger?: ReactNode;
};

export function ProductFormDialog({
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
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setError(null);
      setProductType(initialData?.product_type ?? defaultProductType);
      setSupplierId(initialData?.supplier_id ?? "none");
      setPaymentCategory(initialData?.payment_category ?? "outsourced");
    }
  }, [defaultProductType, initialData, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("product_type", productType);
    formData.set("supplier_id", supplierId);
    formData.set("payment_category", productType === "part" ? paymentCategory ?? "" : "");

    startTransition(async () => {
      const result =
        mode === "create" ? await createProduct(formData) : await updateProduct(initialData?.id ?? "", formData);

      if (result.error) {
        setError(result.error);
        return;
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Product" : "Edit Product"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create a new product profile." : "Update this product profile."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
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
                <Label htmlFor="payment_category">Payment Category</Label>
                <Select
                  disabled={isPending}
                  onValueChange={(value: NonNullable<Product["payment_category"]>) => setPaymentCategory(value)}
                  value={paymentCategory ?? "outsourced"}
                >
                  <SelectTrigger id="payment_category">
                    <SelectValue placeholder="Select payment category" />
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
