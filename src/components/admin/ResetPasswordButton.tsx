"use client";

import { Copy, KeyRound, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resetUserPassword } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [resetLink, setResetLink] = useState<string | null>(null);

  function handleReset() {
    startTransition(async () => {
      const result = await resetUserPassword(userId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.resetLink) {
        setResetLink(result.resetLink);
      } else {
        toast.success("Password reset email sent");
      }
    });
  }

  return (
    <>
      <Button disabled={isPending} onClick={handleReset} size="icon" title="Send password reset" type="button" variant="ghost">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        <span className="sr-only">Reset password</span>
      </Button>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setResetLink(null);
          }
        }}
        open={Boolean(resetLink)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Password Reset Link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Email is not configured. Share this link with the user manually. It expires in 1 hour.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="flex-1 break-all font-mono text-xs text-[#0d1b34]">{resetLink}</p>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(resetLink ?? "");
                toast.success("Copied to clipboard");
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
