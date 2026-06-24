"use client";

import { Loader2 } from "lucide-react";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { upsertCompanySettings } from "@/app/actions/company-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanySettings } from "@/types";

export function CompanyInfoForm({ settings }: { settings: CompanySettings | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const s = settings;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await upsertCompanySettings(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Company info saved");
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="company_name">
            Company name <span className="text-red-500">*</span>
          </Label>
          <Input
            defaultValue={s?.company_name ?? ""}
            disabled={isPending}
            id="company_name"
            name="company_name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company_name_full">Full legal name</Label>
          <Input
            defaultValue={s?.company_name_full ?? ""}
            disabled={isPending}
            id="company_name_full"
            name="company_name_full"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address_line1">Address line 1</Label>
        <Input defaultValue={s?.address_line1 ?? ""} disabled={isPending} id="address_line1" name="address_line1" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address_line2">Address line 2</Label>
        <Input defaultValue={s?.address_line2 ?? ""} disabled={isPending} id="address_line2" name="address_line2" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="city_state">City / State / Postal</Label>
          <Input
            defaultValue={s?.city_state ?? ""}
            disabled={isPending}
            id="city_state"
            name="city_state"
            placeholder="New Taipei City, Taiwan 235026"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Input defaultValue={s?.country ?? ""} disabled={isPending} id="country" name="country" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input defaultValue={s?.phone ?? ""} disabled={isPending} id="phone" name="phone" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input defaultValue={s?.email ?? ""} disabled={isPending} id="email" name="email" type="email" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input
          defaultValue={s?.website ?? ""}
          disabled={isPending}
          id="website"
          name="website"
          placeholder="www.rockhillinnovation.com"
        />
      </div>

      <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sales contact</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="sales_contact_name">Name</Label>
          <Input
            defaultValue={s?.sales_contact_name ?? ""}
            disabled={isPending}
            id="sales_contact_name"
            name="sales_contact_name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sales_contact_email">Email</Label>
          <Input
            defaultValue={s?.sales_contact_email ?? ""}
            disabled={isPending}
            id="sales_contact_email"
            name="sales_contact_email"
            type="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sales_contact_phone">Phone</Label>
          <Input
            defaultValue={s?.sales_contact_phone ?? ""}
            disabled={isPending}
            id="sales_contact_phone"
            name="sales_contact_phone"
          />
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="flex justify-end pt-2">
        <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save company info
        </Button>
      </div>
    </form>
  );
}
