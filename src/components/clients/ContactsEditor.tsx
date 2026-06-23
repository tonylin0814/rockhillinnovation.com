"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateClient } from "@/app/actions/clients";
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
import type { Contact } from "@/types";

const emptyContact: Contact = {
  name: "",
  first_name: "",
  last_name: "",
  role: "",
  email: "",
  phone: "",
  cell_phone: "",
};

type ContactRow = Contact & { _key: string };

function createContactRow(contact?: Partial<Contact>, index = 0): ContactRow {
  const existingName = contact?.name?.trim() ?? "";
  const firstName = contact?.first_name ?? (existingName ? existingName.split(" ")[0] ?? "" : "");
  const lastName = contact?.last_name ?? (existingName ? existingName.split(" ").slice(1).join(" ") : "");

  return {
    ...emptyContact,
    ...contact,
    first_name: firstName,
    last_name: lastName,
    name: contact?.name || [firstName, lastName].filter(Boolean).join(" "),
    _key: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
  };
}

function stripContactKey(contact: ContactRow): Contact {
  const { _key, ...cleanContact } = contact;
  return {
    ...cleanContact,
    name: [cleanContact.first_name, cleanContact.last_name].filter(Boolean).join(" "),
  };
}

export function ContactsEditor({ clientId, initialContacts }: { clientId: string; initialContacts: Contact[] }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>(() => initialContacts.map(createContactRow));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isEditing) {
      setContacts(initialContacts.map(createContactRow));
    }
  }, [initialContacts, isEditing]);

  function updateContact(index: number, field: keyof Contact, value: string) {
    setContacts((current) =>
      current.map((contact, contactIndex) => (contactIndex === index ? { ...contact, [field]: value } : contact))
    );
  }

  function addContact() {
    setContacts((current) => [...current, createContactRow(undefined, current.length)]);
  }

  function removeContact(index: number) {
    setContacts((current) => current.filter((_, contactIndex) => contactIndex !== index));
  }

  function cancelEdit() {
    setContacts(initialContacts.map(createContactRow));
    setIsEditing(false);
  }

  function saveContacts() {
    const formData = new FormData();
    formData.set("contacts", JSON.stringify(contacts.map(stripContactKey)));

    startTransition(async () => {
      const result = await updateClient(clientId, formData);

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
            <TableHead>First Name</TableHead>
            <TableHead>Last Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Cell Phone</TableHead>
            {isEditing ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length ? (
            contacts.map((contact, index) => (
              <TableRow key={contact._key}>
                {(["first_name", "last_name", "role", "email", "phone", "cell_phone"] as const).map((field) => (
                  <TableCell key={field}>
                    {isEditing ? (
                      <Input
                        disabled={isPending}
                        onChange={(event) => updateContact(index, field, event.currentTarget.value)}
                        type={field === "email" ? "email" : "text"}
                        value={contact[field]}
                      />
                    ) : (
                      contact[field] || "-"
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
              <TableCell className="text-slate-500" colSpan={isEditing ? 7 : 6}>
                No contacts yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
