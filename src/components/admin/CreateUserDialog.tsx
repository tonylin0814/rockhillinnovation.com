"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { createUser } from "@/app/actions/users";
import { removeUserClientAccess, setUserClientAccess } from "@/app/actions/user-client-access";
import {
  buildClientAccessState,
  type ClientAccessClient,
  type ClientAccessState,
  UserClientAccessFields,
} from "@/components/admin/UserClientAccessFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/types";

export function CreateUserDialog({ clients }: { clients: ClientAccessClient[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("manager");
  const [clientAccess, setClientAccess] = useState<ClientAccessState>(() => buildClientAccessState(clients));
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("role", role);

    startTransition(async () => {
      const result = await createUser(formData);

      if (result.error || !result.id) {
        setError(result.error ?? "User was created but the user ID was not returned");
        return;
      }

      if (role === "user") {
        for (const [clientId, grant] of Object.entries(clientAccess)) {
          if (grant.enabled) {
            const grantResult = await setUserClientAccess(result.id, clientId, grant.accessLevel);

            if (grantResult.error) {
              setError(grantResult.error);
              return;
            }
          } else {
            await removeUserClientAccess(result.id, clientId);
          }
        }
      }

      setOpen(false);
      toast.success("User created successfully");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>Create an invited account for the Rock Hill platform.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" disabled={isPending} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" disabled={isPending} required type="email" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select disabled={isPending} onValueChange={(value: UserRole) => setRole(value)} value={role}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="controller">Controller</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="partner">Project Partner</SelectItem>
                <SelectItem value="user">User - Client Access</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "user" ? (
            <UserClientAccessFields
              clients={clients}
              disabled={isPending}
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
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
