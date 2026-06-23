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
import type { CurrentUser, UserRole } from "@/types";

type UserRow = CurrentUser & { created_at: string };

const roleBadgeClasses: Record<UserRole, string> = {
  admin: "border-slate-200 bg-slate-100 text-slate-700",
  manager: "border-blue-200 bg-blue-50 text-blue-700",
  partner: "border-violet-200 bg-violet-50 text-violet-700",
};

export default async function UserManagementPage() {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Only admins can manage user accounts.</p>
        </div>
      </div>
    );
  }

  let users: UserRow[] = [];
  let loadError: string | null = null;

  try {
    const supabase = createServerSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, is_active, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      loadError = error.message;
    } else {
      users = (data ?? []) as UserRow[];
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">User Management</h1>
        </div>
        <CreateUserDialog />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.id === currentUser.id;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-[#0d1b34]">
                      <span className="flex items-center gap-2">
                        {user.name}
                        {isSelf ? (
                          <Badge className="border-slate-200 bg-slate-100 text-slate-500" variant="outline">
                            You
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={cn("capitalize", roleBadgeClasses[user.role])} variant="outline">
                        {user.role}
                      </Badge>
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
                      <div className="flex items-center justify-end gap-1">
                        <EditUserDialog
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
