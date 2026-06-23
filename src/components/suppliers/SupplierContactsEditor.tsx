"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateSupplier } from "@/app/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SupplierContact } from "@/types";

const emptyContact: SupplierContact = {
  name: "",
  role: "",
  email: "",
  wechat: "",
  phone: "",
};

export function SupplierContactsEditor({
  initialContacts,
  supplierId,
}: {
  initialContacts: SupplierContact[];
  supplierId: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [contacts, setContacts] = useState<SupplierContact[]>(initialContacts);
  const [isPending, startTransition] = useTransition();

  function updateContact(index: number, field: keyof SupplierContact, value: string) {
    setContacts((current) =>
      current.map((contact, contactIndex) => (contactIndex === index ? { ...contact, [field]: value } : contact))
    );
  }

  function addContact() {
    setContacts((current) => [...current, { ...emptyContact }]);
  }

  function removeContact(index: number) {
    setContacts((current) => current.filter((_, contactIndex) => contactIndex !== index));
  }

  function cancelEdit() {
    setContacts(initialContacts);
    setIsEditing(false);
  }

  function saveContacts() {
    const formData = new FormData();
    formData.set("contacts", JSON.stringify(contacts));

    startTransition(async () => {
      const result = await updateSupplier(supplierId, formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Contacts saved");
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {isEditing ? (
          <>
            <Button disabled={isPending} onClick={addContact} type="button" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
            <Button disabled={isPending} onClick={cancelEdit} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="bg-[#0d1b34] hover:bg-[#13294d]" disabled={isPending} onClick={saveContacts}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Contacts
            </Button>
          </>
        ) : (
          <Button onClick={() => setIsEditing(true)} type="button" variant="outline">
            Edit Contacts
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>WeChat</TableHead>
            <TableHead>Phone</TableHead>
            {isEditing ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length ? (
            contacts.map((contact, index) => (
              <TableRow key={`${contact.email}-${contact.wechat}-${index}`}>
                {(["name", "role", "email", "wechat", "phone"] as const).map((field) => (
                  <TableCell key={field}>
                    {isEditing ? (
                      <Input
                        disabled={isPending}
                        onChange={(event) => updateContact(index, field, event.currentTarget.value)}
                        type={field === "email" ? "email" : "text"}
                        value={contact[field]}
                      />
                    ) : (
                      contact[field] || "—"
                    )}
                  </TableCell>
                ))}
                {isEditing ? (
                  <TableCell>
                    <Button
                      aria-label="Remove contact"
                      disabled={isPending}
                      onClick={() => removeContact(index)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="text-slate-500" colSpan={isEditing ? 6 : 5}>
                No contacts yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
