import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { BankingAccountDialog } from "@/components/admin/BankingAccountDialog";
import { BankingAccountsTable } from "@/components/admin/BankingAccountsTable";
import { AiConfigCard } from "@/components/admin/AiConfigCard";
import { CompanyInfoForm } from "@/components/admin/CompanyInfoForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AiConfig, CompanyBankingAccount, CompanySettings } from "@/types";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = createServerSupabaseClient();
  const [{ data: settings }, { data: bankingAccounts }, { data: aiConfigs }] = await Promise.all([
    supabase.from("company_settings").select("*").limit(1).maybeSingle(),
    supabase.from("company_banking_accounts").select("*").order("sort_order").order("created_at"),
    supabase.from("ai_configs").select("*").like("key", "prompt.%").order("key"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#0d1b34]">Company Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Used on all PDF documents: invoices, quotations, and banking pages.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Name, address, phone, email, website and sales contact shown on PDF headers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyInfoForm settings={(settings ?? null) as CompanySettings | null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Banking Accounts</CardTitle>
            <CardDescription>
              Wire transfer details included as a separate page on every client invoice.
            </CardDescription>
          </div>
          <BankingAccountDialog>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </BankingAccountDialog>
        </CardHeader>
        <CardContent>
          <BankingAccountsTable accounts={(bankingAccounts ?? []) as CompanyBankingAccount[]} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[#0d1b34]">Judy AI Prompts</h2>
          <p className="mt-1 text-sm text-slate-500">Role-specific instructions Judy uses when users open AI tools.</p>
        </div>
        {(aiConfigs ?? []).map((config) => (
          <AiConfigCard config={config as AiConfig} key={config.key} />
        ))}
      </div>
    </div>
  );
}
