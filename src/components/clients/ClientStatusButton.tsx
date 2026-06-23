"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setClientStatus } from "@/app/actions/clients";
import { Button } from "@/components/ui/button";
import type { Client } from "@/types";

export function ClientStatusButton({ clientId, status }: { clientId: string; status: Client["status"] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "active" ? "inactive" : "active";

  function handleClick() {
    startTransition(async () => {
      const result = await setClientStatus(clientId, nextStatus);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(nextStatus === "active" ? "Client reactivated" : "Client deactivated");
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
