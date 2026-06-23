"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { z } from "zod";

import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

const roleSchema = z.enum(["admin", "manager", "partner"]);

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("A valid email is required"),
  role: roleSchema,
});

type ActionResult = {
  success?: true;
  error?: string;
};

function createTemporaryPassword() {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

async function sendInvitationEmail(email: string, temporaryPassword: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`Invitation email skipped for ${email}. Temporary password: ${temporaryPassword}`);
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: "Rock Hill Innovation <sales@rockhillinnovation.com>",
    to: email,
    subject: "You've been invited to Rock Hill Innovation",
    text: `Your account has been created.\n\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nPlease log in at https://www.rockhillinnovation.com and change your password.`,
  });
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid user details" };
  }

  const { name, email, role } = parsed.data;
  const temporaryPassword = createTemporaryPassword();
  const supabase = createServerSupabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (authError || !user) {
    return { error: authError?.message ?? "Could not create auth user" };
  }

  const { error: insertError } = await supabase.from("users").insert({
    id: user.id,
    email,
    name,
    role,
    is_active: true,
  });

  if (insertError) {
    await supabase.auth.admin.deleteUser(user.id);
    return { error: insertError.message };
  }

  try {
    await sendInvitationEmail(email, temporaryPassword);
  } catch (error) {
    console.error("Invitation email failed", error);
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function setUserActive(userId: string, is_active: boolean): Promise<ActionResult> {
  const id = z.string().uuid().safeParse(userId);

  if (!id.success) {
    return { error: "Invalid user ID" };
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await supabase.from("users").update({ is_active }).eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export type CreateUserRole = UserRole;
