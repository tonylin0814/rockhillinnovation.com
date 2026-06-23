export type UserRole = "admin" | "manager" | "partner";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

export type Contact = {
  name: string;
  role: string;
  email: string;
  phone: string;
};

export type Client = {
  id: string;
  code: string;
  name: string;
  country: string | null;
  currency: string;
  deposit_pct: number;
  final_pct: number;
  contacts: Contact[];
  address: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
};
