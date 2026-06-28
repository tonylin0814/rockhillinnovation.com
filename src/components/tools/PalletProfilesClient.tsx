"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createPalletProfile, deletePalletProfile, updatePalletProfile } from "@/app/actions/pallet-profiles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { PalletMaterial, PalletProfile } from "@/types";

const materialLabels: Record<PalletMaterial, string> = {
  paper_honeycomb: "Paper / Honeycomb",
  plastic: "Plastic",
  wood: "Wood",
};

function formatWholeNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return Math.round(numericValue).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function ProfileDialog({
  children,
  profile,
}: {
  children: ReactNode;
  profile?: PalletProfile;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [material, setMaterial] = useState<PalletMaterial>(profile?.material ?? "wood");
  const [isDefault, setIsDefault] = useState(profile?.is_default ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("material", material);
    formData.set("is_default", isDefault ? "true" : "false");

    startTransition(async () => {
      const result = profile
        ? await updatePalletProfile(profile.id, formData)
        : await createPalletProfile(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(profile ? "Pallet profile updated" : "Pallet profile created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit Pallet Profile" : "Add Pallet Profile"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input defaultValue={profile?.name ?? ""} disabled={isPending} id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label>Material</Label>
              <Select disabled={isPending} onValueChange={(value: PalletMaterial) => setMaterial(value)} value={material}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wood">Wood</SelectItem>
                  <SelectItem value="plastic">Plastic</SelectItem>
                  <SelectItem value="paper_honeycomb">Paper / Honeycomb</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="length_cm">Length (cm)</Label>
              <Input defaultValue={profile?.length_cm ?? ""} disabled={isPending} id="length_cm" min="0" name="length_cm" step="0.01" type="number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="width_cm">Width (cm)</Label>
              <Input defaultValue={profile?.width_cm ?? ""} disabled={isPending} id="width_cm" min="0" name="width_cm" step="0.01" type="number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height_cm">Height (cm)</Label>
              <Input defaultValue={profile?.height_cm ?? ""} disabled={isPending} id="height_cm" min="0" name="height_cm" step="0.01" type="number" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max_weight_kg">Max Weight (kg)</Label>
              <Input defaultValue={profile?.max_weight_kg ?? ""} disabled={isPending} id="max_weight_kg" min="0" name="max_weight_kg" step="0.01" type="number" />
            </div>
            <label className="flex items-center gap-2 pt-8 text-sm font-medium text-[#0d1b34]">
              <input
                checked={isDefault}
                className="h-4 w-4 rounded border-slate-300"
                disabled={isPending}
                onChange={(event) => setIsDefault(event.target.checked)}
                type="checkbox"
              />
              Set as Default
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea defaultValue={profile?.notes ?? ""} disabled={isPending} id="notes" name="notes" />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProfileButton({ profile }: { profile: PalletProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePalletProfile(profile.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Pallet profile deleted");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button aria-label="Delete profile" disabled={isPending} size="icon" variant="ghost">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete pallet profile?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {profile.name}. Existing calculations and packing plans are not changed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PalletProfilesClient({ canManage, profiles }: { canManage: boolean; profiles: PalletProfile[] }) {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#0d1b34]">Pallet Profiles</h1>
          <p className="mt-2 text-sm text-slate-500">Manage reusable pallet sizes for calculators and packing tools.</p>
        </div>
        {canManage ? (
          <ProfileDialog>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]">
              <Plus className="mr-2 h-4 w-4" />
              Add Profile
            </Button>
          </ProfileDialog>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>L x W x H (cm)</TableHead>
              <TableHead>Max Weight</TableHead>
              <TableHead>Default</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length ? (
              profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium text-[#0d1b34]">{profile.name}</TableCell>
                  <TableCell>{materialLabels[profile.material]}</TableCell>
                  <TableCell>
                    {profile.length_cm} x {profile.width_cm} x {profile.height_cm}
                  </TableCell>
                  <TableCell>{formatWholeNumber(profile.max_weight_kg)} kg</TableCell>
                  <TableCell>
                    {profile.is_default ? <Badge className="bg-green-600">Default</Badge> : <span className="text-slate-400">-</span>}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <ProfileDialog profile={profile}>
                          <Button aria-label="Edit profile" size="icon" variant="ghost">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </ProfileDialog>
                        <DeleteProfileButton profile={profile} />
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-8 text-center text-slate-500" colSpan={canManage ? 6 : 5}>
                  No pallet profiles yet. Add your first profile.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
