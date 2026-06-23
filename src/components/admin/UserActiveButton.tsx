"use client";

import { Loader2, Power, PowerOff } from "lucide-react";
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
    <Button
      disabled={isPending}
      onClick={handleClick}
      size="icon"
      title={isActive ? "Deactivate user" : "Reactivate user"}
      type="button"
      variant="ghost"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isActive ? (
        <PowerOff className="h-4 w-4 text-amber-600" />
      ) : (
        <Power className="h-4 w-4 text-green-600" />
      )}
      <span className="sr-only">{isActive ? "Deactivate" : "Reactivate"}</span>
    </Button>
  );
}
