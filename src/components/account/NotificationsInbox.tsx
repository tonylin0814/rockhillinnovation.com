"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TradeNotification } from "@/types";

type NotificationsInboxProps = {
  notifications: TradeNotification[];
};

export function NotificationsInbox({ notifications: initialNotifications }: NotificationsInboxProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<TradeNotification[]>(initialNotifications);
  const [, startTransition] = useTransition();
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  async function handleClick(notification: TradeNotification) {
    if (!notification.is_read) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
      );
      await markNotificationRead(notification.id);
    }

    router.push(`/trades/${notification.trade_id}`);
  }

  function handleMarkAll() {
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  if (!notifications.length) {
    return <p className="text-sm text-slate-500">No notifications yet.</p>;
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{unreadCount} unread</p>
          <Button className="gap-1.5 text-xs" onClick={handleMarkAll} size="sm" variant="ghost">
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
      ) : null}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <button
              className={cn(
                "w-full px-4 py-3 text-left transition-colors hover:bg-slate-50",
                !notification.is_read && "bg-blue-50/50 hover:bg-blue-50"
              )}
              onClick={() => handleClick(notification)}
              type="button"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm text-[#0d1b34]", !notification.is_read && "font-medium")}>
                    {notification.message}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {notification.actor_name} -{" "}
                    {new Date(notification.created_at).toLocaleString(undefined, {
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={cn("mt-1 block h-2 w-2 shrink-0 rounded-full", !notification.is_read && "bg-blue-500")}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
