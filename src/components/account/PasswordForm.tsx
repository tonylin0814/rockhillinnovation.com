"use client";

import { Loader2 } from "lucide-react";
import { FormEvent, useRef, useTransition } from "react";
import { toast } from "sonner";

import { updatePassword } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updatePassword(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Password changed successfully");
      formRef.current?.reset();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
      <div className="space-y-1.5">
        <Label htmlFor="password">New Password</Label>
        <Input
          autoComplete="new-password"
          disabled={isPending}
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        <p className="text-xs text-slate-500">At least 8 characters.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm New Password</Label>
        <Input
          autoComplete="new-password"
          disabled={isPending}
          id="confirm"
          minLength={8}
          name="confirm"
          required
          type="password"
        />
      </div>
      <div className="flex justify-end">
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Change Password
        </Button>
      </div>
    </form>
  );
}
