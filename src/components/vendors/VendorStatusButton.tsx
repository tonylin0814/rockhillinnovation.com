"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setVendorStatus } from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
import type { ExpenseVendor } from "@/types";

export function VendorStatusButton({ status, vendorId }: { status: ExpenseVendor["status"]; vendorId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "active" ? "inactive" : "active";

  function handleClick() {
    startTransition(async () => {
      const result = await setVendorStatus(vendorId, nextStatus);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(nextStatus === "active" ? "Vendor reactivated" : "Vendor deactivated");
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
