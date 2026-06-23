"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setUserActive } from "@/app/actions/users";
import { Button } from "@/components/ui/button";

export function UserActiveButton({ isActive, userId }: { isActive: boolean; userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextActiveState = !isActive;

  function handleClick() {
    startTransition(async () => {
      const result = await setUserActive(userId, nextActiveState);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(nextActiveState ? "User reactivated" : "User deactivated");
      router.refresh();
    });
  }

  return (
    <Button disabled={isPending} onClick={handleClick} size="sm" variant="outline">
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
