import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BellButton } from "@/components/layout/BellButton";
import type { TradeNotification } from "@/types";

type TopBarProps = {
  userName: string;
  userId: string;
  initialUnreadCount: number;
  initialNotifications: TradeNotification[];
};

export function TopBar({ userName, userId, initialUnreadCount, initialNotifications }: TopBarProps) {
  const initial = userName
    .split(" ")
    .find(Boolean)
    ?.charAt(0)
    .toUpperCase();

  return (
    <header className="flex h-16 min-w-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <p className="min-w-0 truncate text-sm font-semibold text-[#0d1b34]">Rock Hill Innovation</p>
      <div className="flex shrink-0 items-center gap-2">
        <BellButton
          initialNotifications={initialNotifications}
          initialUnreadCount={initialUnreadCount}
          userId={userId}
        />
        <Link
          className="flex shrink-0 items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
          href="/account"
          title="Account settings"
        >
          <div className="hidden text-right text-sm sm:block">
            <p className="font-medium text-[#0d1b34]">{userName}</p>
            <p className="text-xs text-slate-500">Account settings</p>
          </div>
          <Avatar>
            <AvatarFallback className="bg-[#0d1b34] text-white">{initial || "R"}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
