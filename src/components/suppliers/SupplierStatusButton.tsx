"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setSupplierStatus } from "@/app/actions/suppliers";
import { Button } from "@/components/ui/button";
import type { Supplier } from "@/types";

export function SupplierStatusButton({ status, supplierId }: { status: Supplier["status"]; supplierId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "active" ? "inactive" : "active";

  function handleClick() {
    startTransition(async () => {
      const result = await setSupplierStatus(supplierId, nextStatus);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(nextStatus === "active" ? "Supplier reactivated" : "Supplier deactivated");
      router.refresh();
    });
  }

  return (
    <Button disabled={isPending} onClick={handleClick} size="sm" variant="outline">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {status === "active" ? "Set inactive" : "Set active"}
    </Button>
  );
}
