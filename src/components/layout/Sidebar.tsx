"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  Building2,
  DollarSign,
  Factory,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/types";

type SidebarUser = Pick<CurrentUser, "name" | "role">;

export function Sidebar({ currentUser }: { currentUser: SidebarUser }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const role = currentUser.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isPartner = role === "partner";
  const isUser = role === "user";
  const isAdminOrManager = isAdmin || isManager;
  const isHistoryActive = pathname.startsWith("/history");
  const navItems = [
    { label: t.nav.dashboard, href: "/dashboard", icon: LayoutDashboard },
    { label: t.nav.trades, href: "/trades", icon: ArrowLeftRight },
    { label: t.nav.clients, href: "/clients", icon: Building2 },
    { label: t.nav.suppliers, href: "/suppliers", icon: Factory },
    { label: t.nav.vendors, href: "/vendors", icon: Briefcase },
    { label: t.nav.products, href: "/products", icon: Package },
  ];
  const historySubItems = [
    { label: t.nav.costHistory, href: "/history/cost", icon: DollarSign },
    { label: t.nav.quoteHistory, href: "/history/quote", icon: FileText },
  ];
  const adminNavItems = [
    { label: t.nav.admin, href: "/admin/users", icon: ShieldCheck },
    { label: t.nav.finance, href: "/finance", icon: BarChart3 },
  ];
  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/clients") return isAdminOrManager;
    if (item.href === "/suppliers") return isAdminOrManager;
    if (item.href === "/vendors") return isAdminOrManager;
    if (item.href === "/products") return isAdminOrManager || isPartner || isUser;
    return true;
  });

  function NavLink({
    href,
    icon: Icon,
    indent = false,
    label,
  }: {
    href: string;
    icon: React.ElementType;
    indent?: boolean;
    label: string;
  }) {
    const isActive = pathname === href || pathname.startsWith(`${href}/`);

    return (
      <Link
        className={cn(
          "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
          indent && "ml-4 pl-3",
          isActive ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
        )}
        href={href}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col bg-[#0d1b34] text-white shadow-2xl shadow-slate-950/20">
      <div className="flex h-[112px] items-center border-b border-white/10 px-3">
        <div className="flex h-[82px] w-full items-center justify-center rounded-lg bg-white px-3 shadow-sm">
          <Image
            alt="Rock Hill Innovation"
            className="h-auto w-full object-contain"
            height={496}
            priority
            src="/brand/rockhill-logo-nav-safe.png"
            unoptimized
            width={2075}
          />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1.5 px-3 py-5">
        {visibleNavItems.map((item) => (
          <NavLink href={item.href} icon={item.icon} key={item.href} label={item.label} />
        ))}

        {isAdminOrManager || isPartner ? (
          <>
            <div
              className={cn(
                "mt-1 flex h-10 items-center gap-3 px-3 text-sm font-medium",
                isHistoryActive ? "text-white" : "text-slate-500"
              )}
            >
              <History className="h-4 w-4" />
              {t.nav.history}
            </div>
            {historySubItems.map((item) => (
              <NavLink href={item.href} icon={item.icon} indent key={item.href} label={item.label} />
            ))}
          </>
        ) : null}

        {isAdminOrManager ? <NavLink href="/admin/activity" icon={History} label={t.nav.activity} /> : null}

        {isAdmin
          ? adminNavItems.map((item) => <NavLink href={item.href} icon={item.icon} key={item.href} label={item.label} />)
          : null}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-slate-400">
            <p className="truncate font-medium text-slate-300">{currentUser.name}</p>
            <p className="capitalize">{currentUser.role}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <Button
              aria-label="Logout"
              className="h-8 w-8 border-white/10 bg-transparent p-0 text-slate-400 hover:bg-white/10 hover:text-white"
              size="icon"
              type="submit"
              variant="outline"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
