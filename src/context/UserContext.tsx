"use client";

import { createContext, useContext } from "react";

import type { CurrentUser } from "@/types";

type UserContextValue = {
  user: CurrentUser;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({
  children,
  initialUser,
}: Readonly<{
  children: React.ReactNode;
  initialUser: CurrentUser;
}>) {
  return <UserContext.Provider value={{ user: initialUser }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }

  return context.user;
}
