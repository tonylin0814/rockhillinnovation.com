import { PasswordForm } from "@/components/account/PasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

const roleLabelMap: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  partner: "Project Partner",
};

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0d1b34]">Account Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          {roleLabelMap[user.role] ?? user.role} · Manage your profile and security settings.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm email={user.email} initialName={user.name} />
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Choose a new password. You will remain logged in after changing it.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </section>
  );
}
