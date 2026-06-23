import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

const statCards = [
  { label: "Open Trades", icon: ArrowLeftRight },
  { label: "Pending Reviews", icon: ClipboardCheck },
  { label: "Outstanding from Clients", icon: TrendingUp },
  { label: "Owed to Suppliers", icon: TrendingDown },
  { label: "Settled Trades (This Year)", icon: CheckCircle2 },
  { label: "Net Profit (Settled)", icon: DollarSign },
];

function getGreeting() {
  const hour = new Date().getUTCHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const greeting = getGreeting();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0d1b34]">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">
          {greeting}, {user?.name ?? "there"}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label} className="border-slate-200 shadow-sm">
              <CardContent className="relative p-6">
                <Icon className="absolute right-5 top-5 h-5 w-5 text-slate-300" />
                <p className="pr-8 text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-5 text-3xl font-semibold text-[#0d1b34]">—</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No activity yet.</p>
        </CardContent>
      </Card>
    </section>
  );
}
