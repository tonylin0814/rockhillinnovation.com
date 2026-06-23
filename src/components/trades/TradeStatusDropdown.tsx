"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setTradeStatus } from "@/app/actions/trades";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Trade, UserRole } from "@/types";

const statuses: { label: string; value: Trade["status"] }[] = [
  { label: "Set Draft", value: "draft" },
  { label: "Set Active", value: "active" },
  { label: "Set Settled", value: "settled" },
  { label: "Set Archived", value: "archived" },
];

export function TradeStatusDropdown({
  currentStatus,
  role,
  tradeId,
}: {
  tradeId: string;
  currentStatus: Trade["status"];
  role: UserRole;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (role === "partner") {
    return null;
  }

  function updateStatus(status: Trade["status"]) {
    if (status === currentStatus) {
      return;
    }

    startTransition(async () => {
      const result = await setTradeStatus(tradeId, status);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Trade status updated");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={isPending} variant="outline">
          Status
          <MoreHorizontal className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {statuses.map((status) => (
          <DropdownMenuItem
            disabled={status.value === currentStatus}
            key={status.value}
            onSelect={() => updateStatus(status.value)}
          >
            {status.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
