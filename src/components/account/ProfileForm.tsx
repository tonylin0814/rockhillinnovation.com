"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useTransition } from "react";
import { toast } from "sonner";

import { updateProfile } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({ email, initialName }: { initialName: string; email: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateProfile(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Profile updated");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="name">Display Name</Label>
        <Input defaultValue={initialName} disabled={isPending} id="name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input className="cursor-not-allowed opacity-60" disabled readOnly value={email} />
        <p className="text-xs text-slate-500">Email cannot be changed. Contact an admin if needed.</p>
      </div>
      <div className="flex justify-end">
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
