"use client";

import { Calculator, Package2, Wrench } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BellButton } from "@/components/layout/BellButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";
import type { CurrentUser, TradeNotification } from "@/types";

type TopBarProps = {
  userName: string;
  userId: string;
  userRole: CurrentUser["role"];
  initialUnreadCount: number;
  initialNotifications: TradeNotification[];
};

export function TopBar({ userName, userId, userRole, initialUnreadCount, initialNotifications }: TopBarProps) {
  const { t } = useLanguage();
  const canUseTools = userRole === "admin" || userRole === "manager";
  const initial = userName
    .split(" ")
    .find(Boolean)
    ?.charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-16 min-w-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="min-w-0 truncate text-sm font-semibold text-[#0d1b34]">
        <span>Rock Hill Innovation</span>
        <span className="ml-3 hidden text-slate-500 sm:inline">洛夕爾創新有限公司</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canUseTools ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-[#0d1b34] shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0d1b34]/20">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">{t.nav.tools}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link className="flex items-center gap-2" href="/tools/pallet-calculator">
                  <Calculator className="h-4 w-4" />
                  {t.nav.palletCalculator}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link className="flex items-center gap-2" href="/tools/pallet-profiles">
                  <Package2 className="h-4 w-4" />
                  {t.nav.palletProfiles}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <LanguageSwitcher />
        <BellButton
          initialNotifications={initialNotifications}
          initialUnreadCount={initialUnreadCount}
          userId={userId}
        />
        <Link
          className="flex shrink-0 items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
          href="/account"
          title={t.common.accountSettings}
        >
          <div className="hidden text-right text-sm sm:block">
            <p className="font-medium text-[#0d1b34]">{userName}</p>
            <p className="text-xs text-slate-500">{t.common.accountSettings}</p>
          </div>
          <Avatar>
            <AvatarFallback className="bg-[#0d1b34] text-white">{initial || "R"}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
