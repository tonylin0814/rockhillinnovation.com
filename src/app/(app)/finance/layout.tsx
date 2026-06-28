import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { FinanceNavTabs } from "@/components/finance/FinanceNavTabs";
import { getCurrentUser } from "@/lib/auth";

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user || !["admin", "controller", "manager"].includes(user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4">
      <FinanceNavTabs />
      {children}
    </div>
  );
}
