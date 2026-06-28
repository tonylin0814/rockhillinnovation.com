"use client";

import { Calculator, Package2, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  userEmail: string;
  userId: string;
  userRole: CurrentUser["role"];
  initialUnreadCount: number;
  initialNotifications: TradeNotification[];
};

const welcomeMessages: Record<string, string[]> = {
  "mickylin0122@hotmail.com": [
    "⚖️ Bonjour Maître ! Aujourd'hui, pensez aussi à prendre soin de vous. ❤️",
    "☕ Verdict du jour : café, sourire et zéro urgence juridique. 😄",
    "🏒 Go Habs Go ! Que les Canadiens vous portent chance aujourd'hui !",
    "😊 Même les meilleurs avocats méritent une pause. Prenez soin de vous.",
    "📚⚖️ Article du jour : sourire, respirer et avancer. 😄",
    "❤️ Avant d'aider les autres, pensez un peu à vous.",
    "🏒😂 Si les Canadiens perdent... gardez quand même le sourire !",
    "💼 Le système est prêt, il ne manque plus que votre talent. ☕",
    "🌞 Une nouvelle journée, une nouvelle victoire vous attend.",
    "🤝 Vos clients comptent sur vous, nous aussi. Bonne journée !",
  ],
  "molibox@hotmail.com": [
    "🌸 老婆 ❤️ 今天工作順利，股票一路長紅！📈",
    "📈 願今天只有紅 K，沒有煩惱。🥰",
    "☀️ 希望今天每件小事，都讓妳開心。❤️",
    "💰 願今天財富增加，好運加倍。📈✨",
    "🥰 工作加油，也別忘了照顧自己。❤️",
    "📊 今天祝妳一路長紅，收盤笑咪咪！📈",
    "🌷 願今天充滿好運與好心情。🍀❤️",
    "☕ 股票慢慢漲，老婆天天開心。🥰",
    "🚀 工作順利、心情愉快、股票創新高！📈",
    "❤️ 今天也要笑一笑，好運自然到。😊",
  ],
  "tonylin0814@gmail.com": [
    "🚀 Welcome back, Tony! Let's build something amazing today.",
    "☕ Coffee first. Great ideas next. 😎",
    "💡 Progress beats perfection. Keep shipping.",
    "🌎 Someone is waiting for what you're building.",
    "📈 Business growing. Investments green. Life balanced.",
    "🛠️ Small improvements create big success.",
    "💰 May your businesses grow and your investments stay green. 📈",
    "❤️ Build great companies, but don't forget to enjoy life.",
    "✨ Another day. Another opportunity.",
    "🏔️ Keep building. You're closer than yesterday.",
  ],
};

function getRandomWelcomeMessage(email: string) {
  const messages = welcomeMessages[email.toLowerCase()];

  if (!messages?.length) {
    return "";
  }

  return messages[Math.floor(Math.random() * messages.length)] ?? "";
}

export function TopBar({
  userName,
  userEmail,
  userId,
  userRole,
  initialUnreadCount,
  initialNotifications,
}: TopBarProps) {
  const { t } = useLanguage();
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const canUseTools = userRole === "admin" || userRole === "manager" || userRole === "controller";
  const initial = userName
    .split(" ")
    .find(Boolean)
    ?.charAt(0)
    .toUpperCase();

  useEffect(() => {
    setWelcomeMessage(getRandomWelcomeMessage(userEmail));
  }, [userEmail]);

  return (
    <header className="sticky top-0 z-40 flex h-16 min-w-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="shrink-0 truncate text-sm font-semibold text-[#0d1b34]">
        <span>Rock Hill Innovation</span>
        <span className="ml-3 hidden text-slate-500 sm:inline">洛夕爾創新有限公司</span>
      </div>
      <div className="hidden min-w-0 flex-1 justify-center px-4 xl:flex">
        {welcomeMessage ? (
          <p
            className="max-w-full truncate text-center font-medium text-slate-600"
            style={{ fontSize: welcomeMessage.length > 72 ? "12px" : "13px" }}
            title={welcomeMessage}
          >
            {welcomeMessage}
          </p>
        ) : null}
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
