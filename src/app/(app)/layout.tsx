import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { LanguageProvider } from "@/context/LanguageContext";
import { UserProvider } from "@/context/UserContext";
import { getNotifications, getUnreadCount } from "@/app/actions/notifications";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [initialNotifications, initialUnreadCount] = await Promise.all([getNotifications(50), getUnreadCount()]);

  return (
    <UserProvider initialUser={user}>
      <LanguageProvider>
        <div className="grid h-screen w-full grid-cols-[240px_minmax(0,1fr)] overflow-hidden bg-[#f8fafc]">
          <Sidebar currentUser={{ name: user.name, role: user.role }} />
          <div className="flex min-h-0 min-w-0 flex-col">
            <TopBar
              initialNotifications={initialNotifications}
              initialUnreadCount={initialUnreadCount}
              userEmail={user.email}
              userId={user.id}
              userName={user.name}
              userRole={user.role}
            />
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
          </div>
        </div>
      </LanguageProvider>
    </UserProvider>
  );
}
