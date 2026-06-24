import { ActivityLogTable } from "@/components/admin/ActivityLogTable";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminActivityPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Activity is available to admins and managers only.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0d1b34]">Activity</h1>
      </div>
      <ActivityLogTable />
    </section>
  );
}
