"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Briefcase,
  Building2,
  Factory,
  LayoutDashboard,
  LogOut,
  Package,
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
  { label: "Admin", href: "/admin/users", icon: ShieldCheck },
];

type SidebarUser = Pick<CurrentUser, "name" | "role">;

export function Sidebar({ currentUser }: { currentUser: SidebarUser }) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) => item.label !== "Admin" || currentUser.role === "admin");

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[240px] flex-col bg-[#0d1b34] text-white shadow-2xl shadow-slate-950/20">
      <div className="flex h-[110px] items-center border-b border-white/10 px-3">
        <div className="flex h-[76px] w-full items-center justify-center overflow-hidden rounded-lg bg-white px-3 shadow-sm">
          <Image
            src="/brand/rockhill-logo-nav-cropped.png"
            alt="Rock Hill Innovation"
            width={1955}
            height={424}
            className="max-h-[58px] max-w-full object-contain"
            priority
            unoptimized
          />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1.5 px-3 py-5">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                isActive ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
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
