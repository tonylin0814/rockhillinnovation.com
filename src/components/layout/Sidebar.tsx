"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Building2,
  Factory,
  FolderKanban,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Store,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Trades", href: "/trades", icon: FolderKanban },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Suppliers", href: "/suppliers", icon: Factory },
  { label: "Vendors", href: "/vendors", icon: Store },
  { label: "Products", href: "/products", icon: Package },
  { label: "Admin", href: "/admin/users", icon: ShieldCheck },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) => item.label !== "Admin" || role === "admin");

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[240px] flex-col bg-[#0d1b34] text-white shadow-2xl shadow-slate-950/20">
      <div className="flex h-36 items-center border-b border-white/10 px-4 pt-3">
        <div className="flex h-[108px] w-full items-center justify-center overflow-hidden rounded-md bg-white px-3">
          <Image
            src="/brand/rockhill-logo-cropped.png"
            alt="Rock Hill Innovation"
            width={943}
            height={594}
            className="h-auto w-[172px] object-contain"
            priority
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
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white",
                isActive && "bg-white text-[#0d1b34] shadow-sm hover:bg-white hover:text-[#0d1b34]"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-5 text-slate-400">
        Operations Platform
        <br />
        Rock Hill Innovation Inc. Ltd.
      </div>
    </aside>
  );
}
