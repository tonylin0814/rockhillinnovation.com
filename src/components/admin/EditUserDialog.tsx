"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { removeUserClientAccess, setUserClientAccess } from "@/app/actions/user-client-access";
import { updateUser } from "@/app/actions/users";
import {
  buildClientAccessState,
  type ClientAccessClient,
  type ClientAccessState,
  UserClientAccessFields,
} from "@/components/admin/UserClientAccessFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserClientAccess, UserRole } from "@/types";

export function EditUserDialog({
  initialName,
  initialRole,
  initialGrants,
  isSelf,
  userId,
  clients,
}: {
  userId: string;
  initialName: string;
  initialRole: UserRole;
  initialGrants: UserClientAccess[];
  clients: ClientAccessClient[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [clientAccess, setClientAccess] = useState<ClientAccessState>(() =>
    buildClientAccessState(clients, initialGrants)
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("role", role);

    startTransition(async () => {
      const result = await updateUser(userId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      for (const [clientId, grant] of Object.entries(clientAccess)) {
        const grantResult =
          role === "user" && grant.enabled
            ? await setUserClientAccess(userId, clientId, grant.accessLevel)
            : await removeUserClientAccess(userId, clientId);

        if (grantResult.error) {
          setError(grantResult.error);
          return;
        }
      }

      toast.success("User updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" title="Edit user" type="button" variant="ghost">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit user</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input defaultValue={initialName} disabled={isPending} id="name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select disabled={isPending || isSelf} onValueChange={(value) => setRole(value as UserRole)} value={role}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="controller">Controller</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="partner">Project Partner</SelectItem>
                <SelectItem value="user">User - Client Access</SelectItem>
              </SelectContent>
            </Select>
            {isSelf ? <p className="text-xs text-slate-500">You cannot change your own role.</p> : null}
          </div>
          {role === "user" ? (
            <UserClientAccessFields
              clients={clients}
              disabled={isPending || isSelf}
              onChange={setClientAccess}
              value={clientAccess}
            />
          ) : null}
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
