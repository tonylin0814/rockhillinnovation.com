import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { UserProvider } from "@/context/UserContext";
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

  return (
    <UserProvider initialUser={user}>
      <div className="grid min-h-screen w-full grid-cols-[240px_minmax(0,1fr)] bg-[#f8fafc]">
        <Sidebar currentUser={{ name: user.name, role: user.role }} />
        <div className="flex min-h-screen min-w-0 flex-col">
          <TopBar userName={user.name} />
          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
        </div>
      </div>
    </UserProvider>
  );
}
