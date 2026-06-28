import { redirect } from "next/navigation";

import { PalletProfilesClient } from "@/components/tools/PalletProfilesClient";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PalletProfile } from "@/types";

export default async function PalletProfilesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!["admin", "manager", "controller"].includes(user.role)) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Pallet profiles are available to admins, managers, and controllers only.</p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("pallet_profiles").select("*").order("name", { ascending: true });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error.message}
      </div>
    );
  }

  return <PalletProfilesClient canManage={user.role === "admin"} profiles={(data ?? []) as PalletProfile[]} />;
}
