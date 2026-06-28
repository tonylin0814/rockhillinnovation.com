import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { ResetPasswordButton } from "@/components/admin/ResetPasswordButton";
import { UserActiveButton } from "@/components/admin/UserActiveButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { CurrentUser, UserClientAccess, UserRole } from "@/types";
import { redirect } from "next/navigation";

type UserRow = CurrentUser & { created_at: string };
type ClientOption = { id: string; code: string; name: string };

const roleBadgeClasses: Record<UserRole, string> = {
  admin: "border-slate-200 bg-slate-100 text-slate-700",
  controller: "border-cyan-200 bg-cyan-50 text-cyan-700",
  manager: "border-blue-200 bg-blue-50 text-blue-700",
  partner: "border-violet-200 bg-violet-50 text-violet-700",
  user: "border-amber-200 bg-amber-50 text-amber-700",
};

export default async function UserManagementPage() {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    redirect("/dashboard");
  }

  let users: UserRow[] = [];
  let clients: ClientOption[] = [];
  let grants: UserClientAccess[] = [];
  let loadError: string | null = null;

  try {
    const supabase = createServerSupabaseAdmin();
    const [{ data, error }, { data: clientRows, error: clientsError }, { data: grantRows, error: grantsError }] =
      await Promise.all([
        supabase.from("users").select("id, name, email, role, is_active, created_at").order("created_at", { ascending: true }),
        supabase.from("clients").select("id, code, name").eq("status", "active").order("code", { ascending: true }),
        supabase.from("user_client_access").select("*, client:clients(id, code, name)").order("granted_at", { ascending: true }),
      ]);

    if (error || clientsError || grantsError) {
      loadError = error?.message ?? clientsError?.message ?? grantsError?.message ?? "Could not load users.";
    } else {
      users = (data ?? []) as UserRow[];
      clients = (clientRows ?? []) as ClientOption[];
      grants = (grantRows ?? []) as UserClientAccess[];
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load users.";
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {loadError}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">User Management</h1>
        </div>
        <CreateUserDialog clients={clients} />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">Name</TableHead>
                <TableHead className="min-w-56">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.id === currentUser.id;
                const userGrants = grants.filter((grant) => grant.user_id === user.id);

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-[#0d1b34]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="max-w-52 truncate">{user.name}</span>
                        {isSelf ? (
                          <Badge className="border-slate-200 bg-slate-100 text-slate-500" variant="outline">
                            You
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-slate-600">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={cn("capitalize", roleBadgeClasses[user.role])} variant="outline">
                        {user.role}
                      </Badge>
                      {user.role === "user" ? (
                        <Badge className="ml-2 border-amber-200 bg-white text-amber-700" variant="outline">
                          {userGrants.length} clients
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.is_active
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }
                        variant="outline"
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <EditUserDialog
                          clients={clients}
                          initialGrants={userGrants}
                          initialName={user.name}
                          initialRole={user.role}
                          isSelf={isSelf}
                          userId={user.id}
                        />
                        <ResetPasswordButton userId={user.id} />
                        {!isSelf ? <UserActiveButton isActive={user.is_active} userId={user.id} /> : null}
                        {!isSelf ? <DeleteUserButton userId={user.id} userName={user.name} /> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
