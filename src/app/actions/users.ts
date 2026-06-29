"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export type ActionResult = { success?: true; id?: string; error?: string };
export type ResetResult = { success?: true; resetLink?: string; error?: string };
export type CreateUserRole = UserRole;

const roleSchema = z.enum(["admin", "controller", "manager", "partner", "user"]);

async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (user.role !== "admin") {
    return { error: "Admin access required" };
  }

  return { user };
}

function createTemporaryPassword() {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

async function sendEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "no-reply@rockhillinnovation.com";

  if (!apiKey) {
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, subject, text, to });
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      email: z.string().trim().email("A valid email is required"),
      name: z.string().trim().min(1, "Full name is required"),
      role: roleSchema,
    })
    .safeParse({
      email: formData.get("email"),
      name: formData.get("name"),
      role: formData.get("role"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const { email, name, role } = parsed.data;
  const temporaryPassword = createTemporaryPassword();
  const supabase = createServerSupabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: temporaryPassword,
  });

  if (authError || !user) {
    return { error: authError?.message ?? "Could not create auth user" };
  }

  const { error: insertError } = await supabase.from("users").insert({
    email,
    id: user.id,
    is_active: true,
    name,
    role,
  });

  if (insertError) {
    await supabase.auth.admin.deleteUser(user.id);
    return { error: insertError.message };
  }

  try {
    await sendEmail(
      email,
      "You've been invited to Rock Hill Innovation",
      `Your account has been created.\n\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nPlease log in at https://www.rockhillinnovation.com and change your password.`
    );
  } catch (error) {
    console.error("Invitation email failed", error);
  }

  revalidatePath("/admin/users");
  return { id: user.id, success: true };
}

export async function updateUser(userId: string, formData: FormData): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z
    .object({
      name: z.string().trim().min(1, "Name is required"),
      role: roleSchema,
      userId: z.string().uuid(),
    })
    .safeParse({
      name: formData.get("name"),
      role: formData.get("role"),
      userId,
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  if (parsed.data.userId === access.user.id && parsed.data.role !== "admin") {
    return { error: "You cannot change your own role" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase
    .from("users")
    .update({ name: parsed.data.name, role: parsed.data.role })
    .eq("id", parsed.data.userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function setUserActive(userId: string, is_active: boolean): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.string().uuid().safeParse(userId);

  if (!parsed.success) {
    return { error: "Invalid user ID" };
  }

  if (parsed.data === access.user.id) {
    return { error: "You cannot deactivate your own account" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("users").update({ is_active }).eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function resetUserPassword(userId: string): Promise<ResetResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.string().uuid().safeParse(userId);

  if (!parsed.success) {
    return { error: "Invalid user ID" };
  }

  const supabase = createServerSupabaseAdmin();
  const { data: userRow } = await supabase.from("users").select("email, name").eq("id", userId).maybeSingle();

  if (!userRow) {
    return { error: "User not found" };
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    email: userRow.email,
    type: "recovery",
  });

  if (linkError || !linkData?.properties?.action_link) {
    return { error: linkError?.message ?? "Could not generate reset link" };
  }

  const resetLink = linkData.properties.action_link;

  try {
    await sendEmail(
      userRow.email,
      "Rock Hill Innovation - Password Reset",
      `Hi ${userRow.name},\n\nA password reset was requested for your account.\n\nClick the link below to reset your password (expires in 1 hour):\n${resetLink}\n\nIf you did not request this, please contact your administrator.`
    );

    return { success: true };
  } catch {
    return { resetLink, success: true };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const access = await requireAdmin();

  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = z.string().uuid().safeParse(userId);

  if (!parsed.success) {
    return { error: "Invalid user ID" };
  }

  if (parsed.data === access.user.id) {
    return { error: "You cannot delete your own account" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.auth.admin.deleteUser(parsed.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}
