import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/types";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, name, email, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.is_active) {
    return null;
  }

  return profile;
}
