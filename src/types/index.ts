export type UserRole = "admin" | "manager" | "partner";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};
