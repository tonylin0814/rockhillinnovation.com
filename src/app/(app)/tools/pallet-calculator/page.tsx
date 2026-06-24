import { redirect } from "next/navigation";

import { PalletCalculatorClient } from "@/components/tools/PalletCalculatorClient";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product } from "@/types";

export default async function PalletCalculatorPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "partner") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0d1b34]">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Tools are available to admins and managers only.</p>
        </div>
      </div>
    );
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, supplier:suppliers(id, name, code)")
    .eq("status", "active")
    .order("name_english", { ascending: true });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {error.message}
      </div>
    );
  }

  return <PalletCalculatorClient products={(data ?? []) as Product[]} />;
}
