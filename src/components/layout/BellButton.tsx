"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import type { TradeNotification } from "@/types";

type BellButtonProps = {
  userId: string;
  initialUnreadCount: number;
  initialNotifications: TradeNotification[];
};

export function BellButton({ userId, initialUnreadCount, initialNotifications }: BellButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<TradeNotification[]>(initialNotifications);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`trade_notifications_bell_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `user_id=eq.${userId}`,
          schema: "public",
          table: "trade_notifications",
        },
        (payload) => {
          const notification = payload.new as TradeNotification;
          setNotifications((current) => [notification, ...current].slice(0, 50));
          setUnreadCount((current) => current + (notification.is_read ? 0 : 1));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          filter: `user_id=eq.${userId}`,
          schema: "public",
          table: "trade_notifications",
        },
        (payload) => {
          const updated = payload.new as TradeNotification;
          setNotifications((current) => {
            const next = current.map((notification) => (notification.id === updated.id ? updated : notification));
            setUnreadCount(next.filter((notification) => !notification.is_read).length);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function handleNotificationClick(notification: TradeNotification) {
    if (!notification.is_read) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      await markNotificationRead(notification.id);
    }

    setOpen(false);
    router.push(`/trades/${notification.trade_id}`);
  }

  function handleMarkAll() {
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    setUnreadCount(0);
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  const hasUnread = unreadCount > 0;
  const recentUnread = notifications.filter((notification) => !notification.is_read).slice(0, 10);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ""}`}
          className="relative shrink-0"
          size="icon"
          variant="ghost"
        >
          <Bell className="h-5 w-5 text-slate-600" />
          {hasUnread ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-[#0d1b34]">Notifications</p>
          {hasUnread ? (
            <Button
              className="h-auto p-0 text-xs text-slate-500 hover:text-[#0d1b34]"
              onClick={handleMarkAll}
              size="sm"
              variant="ghost"
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {recentUnread.length ? (
            <ul className="divide-y divide-slate-100">
              {recentUnread.map((notification) => (
                <li key={notification.id}>
                  <button
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    onClick={() => handleNotificationClick(notification)}
                    type="button"
                  >
                    <p className="text-sm text-[#0d1b34]">{notification.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {notification.actor_name} -{" "}
                      {new Date(notification.created_at).toLocaleString(undefined, {
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No unread notifications</p>
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Button
            className="w-full text-xs text-slate-500"
            onClick={() => {
              setOpen(false);
              router.push("/account");
            }}
            size="sm"
            variant="ghost"
          >
            View all in Account Settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
