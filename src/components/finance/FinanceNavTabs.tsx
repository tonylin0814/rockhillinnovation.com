"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/finance", key: "overview" },
  { href: "/finance/payout", key: "payout" },
] as const;

export function FinanceNavTabs() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {tabs.map((tab) => {
        const active = tab.href === "/finance" ? pathname === "/finance" : pathname.startsWith(tab.href);
        const label = tab.key === "overview" ? t.payout.overview : t.payout.title;

        return (
          <Link
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors hover:border-slate-300 hover:text-[#0d1b34]",
              active ? "border-[#0d1b34] text-[#0d1b34]" : "border-transparent text-slate-600"
            )}
            href={tab.href}
            key={tab.href}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
