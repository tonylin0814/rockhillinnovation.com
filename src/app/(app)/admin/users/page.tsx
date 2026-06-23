import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { UserActiveButton } from "@/components/admin/UserActiveButton";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { CurrentUser, UserRole } from "@/types";

type UserRow = CurrentUser & {
  created_at: string;
};

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

  const supabase = createServerSupabaseAdmin();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, name, email, role, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error.message}
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
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
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
              {(users as UserRow[]).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-[#0d1b34]">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
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
                      {user.is_active ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {user.id !== currentUser.id ? (
                      <UserActiveButton isActive={user.is_active} userId={user.id} />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
