"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setProductStatus } from "@/app/actions/products";
import type { Product } from "@/types";

export function ProductStatusButton({ productId, status }: { productId: string; status: Product["status"] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "active" ? "inactive" : "active";

  function handleClick() {
    startTransition(async () => {
      const result = await setProductStatus(productId, nextStatus);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(nextStatus === "active" ? "Product reactivated" : "Product deactivated");
      router.refresh();
    });
  }

  return (
    <button
      aria-checked={status === "active"}
      className="group inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0d1b34] shadow-sm transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isPending}
      onClick={handleClick}
      role="switch"
      type="button"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          status === "active" ? "bg-green-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            status === "active" ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
      <span>{status === "active" ? "Active" : "Inactive"}</span>
      {isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
    </button>
  );
}
