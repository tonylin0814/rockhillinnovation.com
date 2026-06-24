"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Briefcase,
  Building2,
  DollarSign,
  Factory,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Package2,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/types";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Trades", href: "/trades", icon: ArrowLeftRight },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Suppliers", href: "/suppliers", icon: Factory },
  { label: "Vendors", href: "/vendors", icon: Briefcase },
  { label: "Products", href: "/products", icon: Package },
];

const historySubItems = [
  { label: "Cost History", href: "/history/cost", icon: DollarSign },
  { label: "Quote History", href: "/history/quote", icon: FileText },
];

const toolsNavItems = [
  { label: "Pallet Calculator", href: "/tools/pallet-calculator", icon: Package2 },
];

const adminNavItems = [
  { label: "Admin", href: "/admin/users", icon: ShieldCheck },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

type SidebarUser = Pick<CurrentUser, "name" | "role">;

export function Sidebar({ currentUser }: { currentUser: SidebarUser }) {
  const pathname = usePathname();
  const isPartner = currentUser.role === "partner";
  const isAdmin = currentUser.role === "admin";
  const isAdminOrManager = currentUser.role === "admin" || currentUser.role === "manager";
  const isHistoryActive = pathname.startsWith("/history");
  const isToolsActive = pathname.startsWith("/tools");

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
        {navItems.map((item) => (
          <NavLink href={item.href} icon={item.icon} key={item.href} label={item.label} />
        ))}

        {!isPartner ? (
          <>
            <div
              className={cn(
                "mt-1 flex h-10 items-center gap-3 px-3 text-sm font-medium",
                isHistoryActive ? "text-white" : "text-slate-500"
              )}
            >
              <History className="h-4 w-4" />
              History
            </div>
            {historySubItems.map((item) => (
              <NavLink href={item.href} icon={item.icon} indent key={item.href} label={item.label} />
            ))}
          </>
        ) : null}

        {isAdminOrManager ? (
          <>
            <div
              className={cn(
                "mt-1 flex h-10 items-center gap-3 px-3 text-sm font-medium",
                isToolsActive ? "text-white" : "text-slate-500"
              )}
            >
              <Package2 className="h-4 w-4" />
              Tools
            </div>
            {toolsNavItems.map((item) => (
              <NavLink href={item.href} icon={item.icon} indent key={item.href} label={item.label} />
            ))}
          </>
        ) : null}

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
