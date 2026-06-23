import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types";

export function TopBar({ name, role }: { name: string; role: UserRole }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-8 backdrop-blur">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Rock Hill Innovation</p>
        <p className="text-sm font-medium text-[#0d1b34]">Trade operations workspace</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right text-sm sm:block">
          <p className="font-medium text-[#0d1b34]">{name}</p>
          <p className="text-xs capitalize text-slate-500">{role}</p>
        </div>
        <Avatar>
          <AvatarFallback className="bg-[#0d1b34] text-white">{initials || "RH"}</AvatarFallback>
        </Avatar>
        <form action="/api/auth/logout" method="post">
          <Button size="sm" type="submit" variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </form>
      </div>
    </header>
  );
}
